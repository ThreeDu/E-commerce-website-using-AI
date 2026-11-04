/**
 * Lớp tương thích nhỏ: cung cấp phần API Mongoose mà code này dùng, chạy trên Firestore.
 *
 * - Bộ lọc kiểu Mongo được khớp bằng JS. Các điều kiện bằng đơn giản (và một khoảng khi không có
 *   điều kiện bằng) được đẩy xuống Firestore để giảm số document phải đọc, không cần composite index.
 * - findOneAndUpdate / updateOne chạy trong transaction: điều kiện + $inc nguyên tử như Mongo.
 * - Document trả về là object thường có _id, kèm các method ẩn: save(), toObject(), toJSON(), id.
 * - aggregate() không hỗ trợ: các pipeline đã được viết lại bằng JS ở nơi gọi.
 *
 * shortcut: lọc phần còn lại bằng JS nên mỗi truy vấn có thể đọc cả collection; ổn với quy mô đồ án
 * (vài trăm user, vài nghìn đơn). Khi dữ liệu lớn hơn nhiều: thêm composite index và truy vấn đích danh.
 */
const { getDb, newId, isId, toPlain } = require("./firestore");

const registry = {};
const BATCH_LIMIT = 450; // Firestore cho tối đa 500 thao tác mỗi batch

// ─── Đường dẫn field ─────────────────────────────────────────────────────────

function getRaw(obj, path) {
  return path.split(".").reduce((cur, key) => (cur == null ? undefined : cur[key]), obj);
}

/** Tất cả giá trị tại path, đi xuyên qua mảng (ngữ nghĩa Mongo: {tags: "a"} khớp mảng chứa "a"). */
function getValues(obj, path) {
  const segs = path.split(".");
  const out = [];
  (function walk(cur, i) {
    if (cur === undefined) return;
    if (i === segs.length) {
      if (Array.isArray(cur)) out.push(...cur);
      else out.push(cur);
      return;
    }
    if (Array.isArray(cur)) {
      cur.forEach((el) => walk(el, i));
      return;
    }
    if (cur === null || typeof cur !== "object") return;
    walk(cur[segs[i]], i + 1);
  })(obj, 0);
  return out;
}

function setRaw(obj, path, value) {
  const segs = path.split(".");
  let cur = obj;
  segs.slice(0, -1).forEach((key) => {
    if (cur[key] == null || typeof cur[key] !== "object") cur[key] = {};
    cur = cur[key];
  });
  cur[segs[segs.length - 1]] = value;
}

function unsetRaw(obj, path) {
  const segs = path.split(".");
  const parent = segs.length === 1 ? obj : getRaw(obj, segs.slice(0, -1).join("."));
  if (parent && typeof parent === "object") delete parent[segs[segs.length - 1]];
}

// ─── So sánh ─────────────────────────────────────────────────────────────────

function norm(value) {
  if (value instanceof Date) return value.getTime();
  if (value && typeof value === "object" && value._id !== undefined) return String(value._id);
  return value;
}

function eq(a, b) {
  return norm(a) === norm(b);
}

function compare(a, b) {
  const x = norm(a);
  const y = norm(b);
  if (x == null || y == null) return null;
  if (typeof x === "number" && typeof y === "number") return x - y;
  if (typeof x === "string" && typeof y === "string") return x < y ? -1 : x > y ? 1 : 0;
  return null;
}

const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date) && !(v instanceof RegExp);
const isOperatorObject = (v) => isPlainObject(v) && Object.keys(v).length > 0 && Object.keys(v).every((k) => k.startsWith("$"));

// ─── Khớp bộ lọc ─────────────────────────────────────────────────────────────

function exprValue(doc, operand) {
  if (typeof operand === "string" && operand.startsWith("$")) return getRaw(doc, operand.slice(1));
  if (isPlainObject(operand) && operand.$ifNull) {
    const [value, fallback] = operand.$ifNull;
    const v = exprValue(doc, value);
    return v == null ? exprValue(doc, fallback) : v;
  }
  return operand;
}

function evalExpr(doc, expr) {
  const [[op, args]] = Object.entries(expr);
  const [a, b] = args.map((x) => exprValue(doc, x));
  const c = compare(a, b);
  switch (op) {
    case "$lt": return c !== null && c < 0;
    case "$lte": return c !== null && c <= 0;
    case "$gt": return c !== null && c > 0;
    case "$gte": return c !== null && c >= 0;
    case "$eq": return eq(a, b);
    case "$ne": return !eq(a, b);
    default: throw new Error(`$expr ${op} không được hỗ trợ`);
  }
}

function inList(values, list) {
  return list.some((x) => {
    if (x instanceof RegExp) return values.some((v) => typeof v === "string" && x.test(v));
    if (x === null) return values.length === 0 || values.some((v) => v == null);
    return values.some((v) => eq(v, x));
  });
}

function matchOperators(doc, path, values, ops) {
  return Object.entries(ops).every(([op, arg]) => {
    switch (op) {
      case "$eq": return arg === null ? values.length === 0 || values.some((v) => v == null) : values.some((v) => eq(v, arg));
      case "$ne": return arg === null ? values.some((v) => v != null) : !values.some((v) => eq(v, arg));
      case "$in": return inList(values, arg);
      case "$nin": return !inList(values, arg);
      case "$gt": return values.some((v) => (compare(v, arg) ?? -1) > 0);
      case "$gte": return values.some((v) => (compare(v, arg) ?? -1) >= 0);
      case "$lt": return values.some((v) => (compare(v, arg) ?? 1) < 0);
      case "$lte": return values.some((v) => (compare(v, arg) ?? 1) <= 0);
      case "$exists": return (values.length > 0) === Boolean(arg);
      case "$regex": {
        const re = arg instanceof RegExp ? arg : new RegExp(arg, ops.$options || "");
        return values.some((v) => typeof v === "string" && re.test(v));
      }
      case "$options": return true;
      case "$size": {
        const raw = getRaw(doc, path);
        return Array.isArray(raw) && raw.length === arg;
      }
      case "$elemMatch": {
        const raw = getRaw(doc, path);
        return Array.isArray(raw) && raw.some((el) => (isPlainObject(el) ? matches(el, arg) : matchOperators({ v: el }, "v", [el], arg)));
      }
      case "$all": return arg.every((x) => values.some((v) => eq(v, x)));
      default: throw new Error(`Toán tử ${op} không được hỗ trợ`);
    }
  });
}

function matches(doc, filter = {}) {
  return Object.entries(filter).every(([key, cond]) => {
    if (key === "$or") return cond.some((f) => matches(doc, f));
    if (key === "$and") return cond.every((f) => matches(doc, f));
    if (key === "$nor") return !cond.some((f) => matches(doc, f));
    if (key === "$expr") return evalExpr(doc, cond);
    const values = getValues(doc, key);
    if (cond instanceof RegExp) return values.some((v) => typeof v === "string" && cond.test(v));
    if (isOperatorObject(cond)) return matchOperators(doc, key, values, cond);
    if (cond === null || cond === undefined) return values.length === 0 || values.some((v) => v == null);
    return values.some((v) => eq(v, cond));
  });
}

// ─── Cập nhật ────────────────────────────────────────────────────────────────

function applyUpdate(doc, update) {
  const hasOps = Object.keys(update).some((k) => k.startsWith("$"));
  const ops = hasOps ? update : { $set: update };
  for (const [op, fields] of Object.entries(ops)) {
    for (const [path, arg] of Object.entries(fields || {})) {
      switch (op) {
        case "$set": setRaw(doc, path, arg); break;
        case "$unset": unsetRaw(doc, path); break;
        case "$inc": setRaw(doc, path, (Number(getRaw(doc, path)) || 0) + Number(arg)); break;
        case "$setOnInsert": break;
        case "$push": {
          const arr = Array.isArray(getRaw(doc, path)) ? getRaw(doc, path) : [];
          arr.push(...(isPlainObject(arg) && arg.$each ? arg.$each : [arg]));
          setRaw(doc, path, arr);
          break;
        }
        case "$addToSet": {
          const arr = Array.isArray(getRaw(doc, path)) ? getRaw(doc, path) : [];
          (isPlainObject(arg) && arg.$each ? arg.$each : [arg]).forEach((v) => {
            if (!arr.some((x) => eq(x, v))) arr.push(v);
          });
          setRaw(doc, path, arr);
          break;
        }
        case "$pull": {
          const arr = Array.isArray(getRaw(doc, path)) ? getRaw(doc, path) : [];
          const remove = (el) => {
            if (isOperatorObject(arg)) return matchOperators({ v: el }, "v", [el], arg);
            if (isPlainObject(arg)) return isPlainObject(el) && matches(el, arg);
            return eq(el, arg);
          };
          setRaw(doc, path, arr.filter((el) => !remove(el)));
          break;
        }
        default: throw new Error(`Toán tử cập nhật ${op} không được hỗ trợ`);
      }
    }
  }
  return doc;
}

// ─── Sắp xếp / chọn field ────────────────────────────────────────────────────

function parseSort(spec) {
  if (!spec) return [];
  if (typeof spec === "string") {
    return spec.split(/\s+/).filter(Boolean).map((k) => (k.startsWith("-") ? [k.slice(1), -1] : [k, 1]));
  }
  return Object.entries(spec).map(([k, dir]) => [k, dir === -1 || dir === "desc" || dir === "descending" ? -1 : 1]);
}

function sortDocs(docs, spec) {
  const keys = parseSort(spec);
  if (!keys.length) return docs;
  return docs.sort((a, b) => {
    for (const [key, dir] of keys) {
      const x = norm(getRaw(a, key));
      const y = norm(getRaw(b, key));
      if (x === y) continue;
      if (x == null) return -dir;
      if (y == null) return dir;
      return (x < y ? -1 : 1) * dir;
    }
    return 0;
  });
}

function parseSelect(spec) {
  const sel = { include: new Set(), exclude: new Set(), force: new Set() };
  if (!spec) return sel;
  if (typeof spec === "string") {
    spec.split(/\s+/).filter(Boolean).forEach((k) => {
      if (k.startsWith("-")) sel.exclude.add(k.slice(1));
      else if (k.startsWith("+")) sel.force.add(k.slice(1));
      else sel.include.add(k);
    });
  } else {
    Object.entries(spec).forEach(([k, v]) => (v ? sel.include : sel.exclude).add(k));
  }
  return sel;
}

function applySelect(doc, sel, hidden) {
  hidden.forEach((field) => {
    if (!sel.force.has(field) && !sel.include.has(field)) delete doc[field];
  });
  const includes = [...sel.include].filter((k) => k !== "_id");
  if (includes.length) {
    const keep = new Set(includes.map((k) => k.split(".")[0]));
    Object.keys(doc).forEach((k) => {
      if (k !== "_id" && !keep.has(k)) delete doc[k];
    });
  }
  sel.exclude.forEach((k) => (k === "_id" ? delete doc._id : unsetRaw(doc, k)));
  return doc;
}

function clone(value) {
  if (value instanceof Date) return new Date(value.getTime());
  if (Array.isArray(value)) return value.map(clone);
  if (isPlainObject(value)) {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = clone(v);
    return out;
  }
  return value;
}

// ─── Model ───────────────────────────────────────────────────────────────────

/**
 * cfg: { collection, timestamps, defaults, lower, upper, trim, hidden, arrays, subdocArrays,
 *        subDefaults, subTimestamps, refs, unique, ttl: { field, seconds }, normalize(doc) }
 * defaults: giá trị, hoặc hàm trả về giá trị.
 */
function defineModel(name, cfg) {
  const conf = {
    timestamps: true, defaults: {}, lower: [], upper: [], trim: [], hidden: [], arrays: [],
    subdocArrays: [], subDefaults: {}, subTimestamps: {}, refs: {}, unique: [], ...cfg,
  };
  const col = () => getDb().collection(conf.collection);
  const refOf = (id) => col().doc(String(id));

  function hydrate(id, data, isNew = false) {
    const doc = { _id: id, ...data };
    Object.defineProperties(doc, {
      id: { get: () => doc._id, enumerable: false, configurable: true },
      $isNew: { value: isNew, writable: true, enumerable: false },
      save: { value: () => saveDoc(doc), enumerable: false },
      toObject: { value: () => clone({ ...doc }), enumerable: false },
      toJSON: { value: () => ({ ...doc }), enumerable: false },
      deleteOne: { value: () => refOf(doc._id).delete(), enumerable: false },
    });
    conf.subdocArrays.forEach((field) => {
      if (Array.isArray(doc[field])) {
        Object.defineProperty(doc[field], "id", {
          value: (subId) => doc[field].find((el) => String(el._id) === String(subId)) || null,
          enumerable: false,
        });
      }
    });
    return doc;
  }

  const fromSnap = (snap) => (snap.exists ? hydrate(snap.id, toPlain(snap.data())) : null);

  function applyDefaults(doc) {
    for (const [path, value] of Object.entries(conf.defaults)) {
      if (getRaw(doc, path) === undefined) setRaw(doc, path, typeof value === "function" ? value() : clone(value));
    }
  }

  // Chuẩn hoá trước khi ghi: trim/lowercase/uppercase, subdocument, hook riêng, timestamps, TTL
  function prepare(doc, isNew) {
    if (isNew) applyDefaults(doc);
    conf.trim.forEach((p) => typeof getRaw(doc, p) === "string" && setRaw(doc, p, getRaw(doc, p).trim()));
    conf.lower.forEach((p) => typeof getRaw(doc, p) === "string" && setRaw(doc, p, getRaw(doc, p).toLowerCase()));
    conf.upper.forEach((p) => typeof getRaw(doc, p) === "string" && setRaw(doc, p, getRaw(doc, p).toUpperCase()));
    const now = new Date();
    conf.subdocArrays.forEach((field) => {
      (Array.isArray(doc[field]) ? doc[field] : []).forEach((el) => {
        if (!isPlainObject(el)) return;
        if (!el._id) el._id = newId();
        for (const [k, v] of Object.entries(conf.subDefaults[field] || {})) {
          if (el[k] === undefined) el[k] = typeof v === "function" ? v() : clone(v);
        }
        if (conf.subTimestamps[field]) {
          if (!el.createdAt) el.createdAt = now;
          el.updatedAt = el.updatedAt || now;
        }
      });
    });
    if (conf.normalize) conf.normalize(doc);
    if (conf.timestamps) {
      // new Date(): ép số (Date.now()) / chuỗi thành Date như Mongoose cast theo schema
      if (isNew) doc.createdAt = doc.createdAt ? new Date(doc.createdAt) : now;
      doc.updatedAt = isNew && doc.updatedAt ? new Date(doc.updatedAt) : now;
    }
    if (conf.ttl && doc[conf.ttl.field] instanceof Date) {
      doc.expireAt = new Date(doc[conf.ttl.field].getTime() + conf.ttl.seconds * 1000);
    }
    return doc;
  }

  // Bỏ _id, đổi document đã populate về lại id
  function toStore(doc) {
    const data = clone({ ...doc });
    delete data._id;
    for (const path of Object.keys(conf.refs)) {
      const segs = path.split(".");
      (function walk(cur, i) {
        if (cur == null || typeof cur !== "object") return;
        if (Array.isArray(cur)) return cur.forEach((el) => walk(el, i));
        const key = segs[i];
        if (i === segs.length - 1) {
          const v = cur[key];
          if (Array.isArray(v)) cur[key] = v.map((x) => (isPlainObject(x) && x._id ? String(x._id) : x));
          else if (isPlainObject(v) && v._id) cur[key] = String(v._id);
          return;
        }
        walk(cur[key], i + 1);
      })(data, 0);
    }
    return data;
  }

  // Unique: kiểm tra trong cùng transaction với thao tác ghi; lỗi mang code 11000 như Mongo
  async function assertUnique(tx, doc) {
    for (const fields of conf.unique) {
      const values = fields.map((f) => getRaw(doc, f));
      if (fields.length === 1 && (values[0] === undefined || values[0] === "" || values[0] === null)) continue;
      let q = col();
      fields.forEach((f, i) => { q = q.where(f, "==", values[i] === undefined ? null : values[i]); });
      const snap = await tx.get(q.limit(2));
      if (snap.docs.some((d) => d.id !== String(doc._id))) {
        const err = new Error(`E11000 duplicate key: ${name} ${fields.join(",")}`);
        err.code = 11000;
        err.keyValue = Object.fromEntries(fields.map((f, i) => [f, values[i]]));
        throw err;
      }
    }
  }

  async function saveDoc(doc) {
    const isNew = doc.$isNew;
    if (!doc._id) doc._id = newId();
    prepare(doc, isNew);
    await getDb().runTransaction(async (tx) => {
      await assertUnique(tx, doc);
      // merge: document đọc với select() vẫn giữ các field không được chọn
      if (isNew) tx.create(refOf(doc._id), toStore(doc));
      else tx.set(refOf(doc._id), toStore(doc), { merge: true });
    });
    doc.$isNew = false;
    return doc;
  }

  // Đẩy điều kiện đơn giản xuống Firestore; phần còn lại vẫn được matches() kiểm tra lại
  function pushdown(filter) {
    let q = col();
    let complete = true;
    const equals = [];
    const ranges = [];
    let inClause = null;
    for (const [key, cond] of Object.entries(filter)) {
      const simpleField = !key.startsWith("$") && !key.includes(".") && !conf.arrays.includes(key);
      const scalar = typeof cond === "string" || typeof cond === "number" || typeof cond === "boolean";
      if (simpleField && scalar) equals.push([key, cond]);
      else if (simpleField && isOperatorObject(cond) && Object.keys(cond).join() === "$in"
        && cond.$in.length > 0 && cond.$in.length <= 30 && cond.$in.every((v) => typeof v === "string" || typeof v === "number")) inClause = inClause ? (complete = false, inClause) : [key, cond.$in];
      else if (simpleField && isOperatorObject(cond) && Object.keys(cond).every((k) => ["$gt", "$gte", "$lt", "$lte"].includes(k))) ranges.push([key, cond]);
      else complete = false;
    }
    equals.forEach(([k, v]) => { q = q.where(k, "==", v); });
    if (inClause && equals.length === 0) q = q.where(inClause[0], "in", inClause[1]);
    else if (inClause) complete = false;
    if (ranges.length === 1 && equals.length === 0 && !inClause) {
      const [field, cond] = ranges[0];
      const opMap = { $gt: ">", $gte: ">=", $lt: "<", $lte: "<=" };
      Object.entries(cond).forEach(([op, v]) => { q = q.where(field, opMap[op], v); });
    } else if (ranges.length) complete = false;
    return { query: q, complete };
  }

  async function findDocs(filter = {}, tx = null) {
    const read = (target) => (tx ? tx.get(target) : target.get());
    const idCond = filter._id;
    let docs;
    if (idCond !== undefined && !isOperatorObject(idCond)) {
      // ID sai định dạng (như CastError của Mongoose): coi như không tìm thấy, tránh path "a/b" lạ
      if (!isId(norm(idCond))) return [];
      docs = [fromSnap(await read(refOf(norm(idCond))))].filter(Boolean);
    } else if (isOperatorObject(idCond) && Array.isArray(idCond.$in)) {
      const ids = [...new Set(idCond.$in.map((x) => String(norm(x))).filter(isId))];
      const refs = ids.map(refOf);
      const snaps = [];
      for (let i = 0; i < refs.length; i += 100) {
        const chunk = refs.slice(i, i + 100);
        if (chunk.length) snaps.push(...(tx ? await tx.getAll(...chunk) : await getDb().getAll(...chunk)));
      }
      docs = snaps.map(fromSnap).filter(Boolean);
    } else {
      const { query } = pushdown(filter);
      docs = (await read(query)).docs.map(fromSnap);
    }
    return docs.filter((d) => matches(d, filter));
  }

  async function populate(docs, specs) {
    for (const spec of specs) {
      const { path, select } = typeof spec === "string" ? { path: spec } : spec;
      const refModel = registry[conf.refs[path]];
      if (!refModel) throw new Error(`Không populate được ${name}.${path}`);
      const segs = path.split(".");
      const visit = (cb) => docs.forEach((doc) => (function walk(cur, i) {
        if (cur == null || typeof cur !== "object") return;
        if (Array.isArray(cur)) return cur.forEach((el) => walk(el, i));
        if (i === segs.length - 1) return cb(cur, segs[i]);
        walk(cur[segs[i]], i + 1);
      })(doc, 0));
      const ids = new Set();
      visit((obj, key) => [].concat(obj[key] ?? []).forEach((v) => v != null && ids.add(String(norm(v)))));
      const found = await refModel.find({ _id: { $in: [...ids] } }).select(select);
      const byId = new Map(found.map((d) => [String(d._id), d]));
      visit((obj, key) => {
        const v = obj[key];
        obj[key] = Array.isArray(v)
          ? v.map((x) => byId.get(String(norm(x)))).filter(Boolean)
          : v == null ? v : byId.get(String(norm(v))) || null;
      });
    }
    return docs;
  }

  async function updateFirst(filter, update, { upsert = false, sort, returnNew = false } = {}) {
    return getDb().runTransaction(async (tx) => {
      const candidates = sortDocs(await findDocs(filter, tx), sort);
      let doc = candidates[0];
      if (!doc) {
        if (!upsert) return { before: null, after: null };
        // Như Mongo: document mới lấy các điều kiện bằng trong filter + $setOnInsert, rồi áp update
        const { _id, ...base } = Object.fromEntries(
          Object.entries(filter).filter(([k, v]) => !k.startsWith("$") && !isOperatorObject(v))
        );
        doc = hydrate(_id ? String(norm(_id)) : newId(), { ...clone(base), ...clone(update.$setOnInsert || {}) }, true);
        applyUpdate(doc, update);
        prepare(doc, true);
        await assertUnique(tx, doc);
        tx.create(refOf(doc._id), toStore(doc));
        return { before: null, after: doc, upserted: true };
      }
      const before = hydrate(doc._id, clone({ ...doc }));
      applyUpdate(doc, update);
      prepare(doc, false);
      await assertUnique(tx, doc);
      tx.set(refOf(doc._id), toStore(doc));
      return { before, after: doc };
    });
  }

  async function writeBatches(items, apply) {
    for (let i = 0; i < items.length; i += BATCH_LIMIT) {
      const batch = getDb().batch();
      items.slice(i, i + BATCH_LIMIT).forEach((item) => apply(batch, item));
      await batch.commit();
    }
  }

  class Query {
    constructor(run) {
      this._run = run;
      this._sort = null;
      this._skip = 0;
      this._limit = 0;
      this._select = null;
      this._populate = [];
    }
    sort(spec) { this._sort = spec; return this; }
    skip(n) { this._skip = Number(n) || 0; return this; }
    limit(n) { this._limit = Number(n) || 0; return this; }
    select(spec) { if (spec) this._select = spec; return this; }
    populate(path, select) {
      if (Array.isArray(path)) path.forEach((p) => this.populate(p));
      else this._populate.push(typeof path === "string" ? { path, select } : path);
      return this;
    }
    lean() { return this; }
    session() { return this; }
    async exec() {
      const result = await this._run(this);
      const shape = async (docs) => {
        const sel = parseSelect(this._select);
        docs.forEach((d) => applySelect(d, sel, conf.hidden));
        return this._populate.length ? populate(docs, this._populate) : docs;
      };
      if (Array.isArray(result) && this._presliced) return shape(result);
      if (Array.isArray(result)) {
        let docs = sortDocs(result, this._sort);
        if (this._skip) docs = docs.slice(this._skip);
        if (this._limit) docs = docs.slice(0, this._limit);
        return shape(docs);
      }
      if (result && typeof result === "object" && result._id !== undefined) return (await shape([result]))[0];
      return result;
    }
    then(resolve, reject) { return this.exec().then(resolve, reject); }
    catch(reject) { return this.exec().catch(reject); }
  }

  const findOneDoc = async (filter, q) => sortDocs(await findDocs(filter), q._sort)[0] || null;

  // Như Mongoose: document mới có _id ngay khi khởi tạo (code dùng doc._id trước khi save)
  function Model(data = {}) {
    const { _id, ...rest } = data;
    return hydrate(_id ? String(norm(_id)) : newId(), clone(rest), true);
  }

  Object.assign(Model, {
    modelName: name,
    config: conf,
    matches,
    collectionRef: col,

    find: (filter = {}, projection) => new Query(async (q) => {
      // Danh sách không lọc + sắp xếp một field + phân trang: để Firestore sort/offset/limit
      // (index một field có sẵn) thay vì đọc cả collection, ví dụ trang đơn hàng / log admin.
      const keys = parseSort(q._sort);
      if (Object.keys(filter).length === 0 && keys.length === 1 && q._limit) {
        const [field, dir] = keys[0];
        let query = col().orderBy(field, dir === -1 ? "desc" : "asc");
        if (q._skip) query = query.offset(q._skip);
        q._presliced = true;
        return (await query.limit(q._limit).get()).docs.map(fromSnap);
      }
      return findDocs(filter);
    }).select(projection),
    findOne: (filter = {}, projection) => new Query((q) => findOneDoc(filter, q)).select(projection),
    findById: (id, projection) => new Query(() => (id == null ? null : findOneDoc({ _id: String(norm(id)) }, {}))).select(projection),
    exists: async (filter) => {
      const doc = await findOneDoc(filter, {});
      return doc ? { _id: doc._id } : null;
    },
    countDocuments: async (filter = {}) => {
      const { query, complete } = pushdown(filter);
      if (complete && filter._id === undefined) return (await query.count().get()).data().count;
      return (await findDocs(filter)).length;
    },
    distinct: async (field, filter = {}) => {
      const seen = new Map();
      (await findDocs(filter)).forEach((d) => getValues(d, field).forEach((v) => v != null && seen.set(norm(v), v)));
      return [...seen.values()];
    },

    create: async (data) => {
      if (Array.isArray(data)) return Promise.all(data.map((d) => Model.create(d)));
      return saveDoc(Model(data));
    },
    insertMany: async (items) => {
      const docs = items.map((d) => prepare(Model(d), true));
      docs.forEach((d) => { if (!d._id) d._id = newId(); });
      if (conf.unique.length) {
        for (const d of docs) await saveDoc(d);
      } else {
        await writeBatches(docs, (batch, d) => batch.set(refOf(d._id), toStore(d)));
      }
      docs.forEach((d) => { d.$isNew = false; });
      return docs;
    },

    findOneAndUpdate: (filter, update, opts = {}) => new Query(async () => {
      const { before, after } = await updateFirst(filter, update, { ...opts, returnNew: opts.new });
      return opts.new || opts.returnDocument === "after" ? after : before;
    }),
    findByIdAndUpdate: (id, update, opts = {}) => Model.findOneAndUpdate({ _id: String(norm(id)) }, update, opts),
    updateOne: async (filter, update, opts = {}) => {
      const { after, upserted } = await updateFirst(filter, update, opts);
      return { acknowledged: true, matchedCount: after && !upserted ? 1 : 0, modifiedCount: after && !upserted ? 1 : 0, upsertedCount: upserted ? 1 : 0 };
    },
    updateMany: async (filter, update) => {
      const docs = await findDocs(filter);
      docs.forEach((d) => prepare(applyUpdate(d, update), false));
      await writeBatches(docs, (batch, d) => batch.set(refOf(d._id), toStore(d)));
      return { acknowledged: true, matchedCount: docs.length, modifiedCount: docs.length };
    },
    deleteMany: async (filter = {}) => {
      const docs = await findDocs(filter);
      await writeBatches(docs, (batch, d) => batch.delete(refOf(d._id)));
      return { acknowledged: true, deletedCount: docs.length };
    },
    deleteOne: async (filter = {}) => {
      const doc = await findOneDoc(filter, {});
      if (doc) await refOf(doc._id).delete();
      return { acknowledged: true, deletedCount: doc ? 1 : 0 };
    },
    findOneAndDelete: (filter) => new Query(async (q) => {
      const doc = await findOneDoc(filter, q);
      if (doc) await refOf(doc._id).delete();
      return doc;
    }),
    findByIdAndDelete: (id) => Model.findOneAndDelete({ _id: String(norm(id)) }),
    bulkWrite: async (ops) => {
      const result = { insertedCount: 0, matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
      for (const op of ops) {
        if (op.insertOne) {
          await Model.create(op.insertOne.document);
          result.insertedCount += 1;
        } else if (op.updateOne) {
          const r = await Model.updateOne(op.updateOne.filter, op.updateOne.update, { upsert: op.updateOne.upsert });
          result.matchedCount += r.matchedCount;
          result.modifiedCount += r.modifiedCount;
          result.upsertedCount += r.upsertedCount;
        } else {
          throw new Error(`bulkWrite: thao tác ${Object.keys(op)[0]} không được hỗ trợ`);
        }
      }
      return result;
    },
    aggregate: () => {
      throw new Error(`${name}.aggregate() không được hỗ trợ trên Firestore: tính bằng JS ở nơi gọi`);
    },
  });

  registry[name] = Model;
  return Model;
}

const NOW = () => new Date();
const EMPTY_OBJECT = () => ({});

module.exports = { defineModel, matches, applyUpdate, sortDocs, NOW, EMPTY_OBJECT };
