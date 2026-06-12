import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { useAuth } from "../../../context/AuthContext";
import { useNotification } from "../../../context/NotificationContext";
import { getAdminCategories } from "../../../services/admin/categoryService";
import {
  commitAdminProductImport,
  previewAdminProductImport,
} from "../../../services/admin/productService";
import { getErrorMessage } from "../../../utils/adminErrorUtils";
const TEMPLATE_COLUMNS = [
  "name",
  "category_path",
  "price",
  "stock",
  "discount_percent",
  "description",
  "image_url",
];

const PREVIEW_LIMIT = 12;
const TEMPLATE_FILE_NAME = "product_import_template.xlsx";

function AdminBulkImportProductPage() {
  const navigate = useNavigate();
  const { auth } = useAuth();
  const { success, error: notifyError, warning } = useNotification();

  const [selectedFileName, setSelectedFileName] = useState("");
  const [rows, setRows] = useState([]);
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [categories, setCategories] = useState([]);

  const parsedPreviewRows = useMemo(() => {
    if (!preview?.validRows?.length) {
      return [];
    }

    return preview.validRows.slice(0, PREVIEW_LIMIT);
  }, [preview]);

  const hasPreviewErrors = Number(preview?.summary?.errorRows || 0) > 0;
  const hasPreviewValidRows = Number(preview?.summary?.validRows || 0) > 0;

  useEffect(() => {
    const loadCategories = async () => {
      if (!auth?.token) {
        return;
      }

      try {
        const data = await getAdminCategories(auth.token);
        setCategories(data.categories || []);
      } catch (error) {
        notifyError(getErrorMessage(error, "Không thể tải danh mục cho file template."), {
          title: "Import sản phẩm",
        });
      }
    };

    loadCategories();
  }, [auth?.token, notifyError]);

  const categoriesById = useMemo(() => {
    const map = new Map();
    categories.forEach((item) => {
      map.set(String(item._id), item);
    });
    return map;
  }, [categories]);

  const getCategoryPath = useCallback((category) => {
    const path = [category.name];
    let cursor = category;
    const visited = new Set();

    while (cursor?.parentId) {
      const parentId = String(cursor.parentId);
      if (visited.has(parentId)) {
        break;
      }

      visited.add(parentId);
      const parent = categoriesById.get(parentId);
      if (!parent) {
        break;
      }

      path.unshift(parent.name);
      cursor = parent;
    }

    return path.join(" > ");
  }, [categoriesById]);

  const categoryTemplateRows = useMemo(() => {
    const sorted = [...categories].sort((a, b) => getCategoryPath(a).localeCompare(getCategoryPath(b), "vi"));

    return sorted.map((item) => {
      const path = getCategoryPath(item);
      return {
        category_path: path,
        category_name: item.name,
        parent_id: item.parentId ? String(item.parentId) : "",
      };
    });
  }, [categories, getCategoryPath]);

  const handleDownloadTemplate = () => {
    const sampleCategoryPath = categoryTemplateRows[0]?.category_path || "Thời trang > Áo > Áo thun";
    const worksheetData = [
      TEMPLATE_COLUMNS,
      [
        "Áo thun basic unisex",
        sampleCategoryPath,
        199000,
        120,
        10,
        "Áo thun cotton form regular",
        "https://example.com/images/ao-thun-basic.jpg",
      ],
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const categoryWorksheet = XLSX.utils.json_to_sheet(categoryTemplateRows);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "ProductsTemplate");
    XLSX.utils.book_append_sheet(workbook, categoryWorksheet, "Categories");
    XLSX.writeFile(workbook, TEMPLATE_FILE_NAME);
    success("Đã tải file template Excel.", { title: "Import sản phẩm" });
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setPreview(null);
    setRows([]);
    setSelectedFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const firstSheet = workbook.Sheets[firstSheetName];

      const parsedRows = XLSX.utils.sheet_to_json(firstSheet, {
        defval: "",
        raw: false,
      });

      if (!Array.isArray(parsedRows) || parsedRows.length === 0) {
        warning("File Excel không có dữ liệu hợp lệ.", { title: "Import sản phẩm" });
        return;
      }

      setRows(parsedRows);
      success(`Đã đọc ${parsedRows.length} dòng từ file.`, { title: "Import sản phẩm" });
    } catch (error) {
      notifyError(getErrorMessage(error, "Không thể đọc file Excel."), { title: "Import sản phẩm" });
    }
  };

  const handlePreview = async () => {
    if (!auth?.token) {
      return;
    }

    if (rows.length === 0) {
      warning("Vui lòng chọn file Excel trước khi xem trước.", { title: "Import sản phẩm" });
      return;
    }

    try {
      setPreviewing(true);
      const data = await previewAdminProductImport(auth.token, rows);
      setPreview(data);

      if (Number(data.summary?.errorRows || 0) > 0) {
        warning("Preview có dòng lỗi. Vui lòng sửa file trước khi import.", { title: "Import sản phẩm" });
      } else {
        success("Preview dữ liệu thành công.", { title: "Import sản phẩm" });
      }
    } catch (error) {
      notifyError(getErrorMessage(error, "Không thể preview dữ liệu import."), { title: "Import sản phẩm" });
    } finally {
      setPreviewing(false);
    }
  };

  const handleCommit = async () => {
    if (!auth?.token) {
      return;
    }

    if (!preview || hasPreviewErrors || !hasPreviewValidRows) {
      warning("Chỉ có thể import khi preview hợp lệ và không có lỗi.", { title: "Import sản phẩm" });
      return;
    }

    try {
      setCommitting(true);
      const data = await commitAdminProductImport(auth.token, rows, "create");

      navigate("/admin/products", {
        state: {
          successMessage: data.message || "Import sản phẩm thành công.",
        },
      });
    } catch (error) {
      notifyError(getErrorMessage(error, "Không thể import sản phẩm."), { title: "Import sản phẩm" });
    } finally {
      setCommitting(false);
    }
  };

  return (
    <main className="w-[min(1100px,92%)] mx-auto flex-1 py-10">
      <section className="bg-white border border-admin-line rounded-[18px] p-6 shadow-[0_12px_32px_rgba(15,23,42,0.08)] animate-admin-rise" aria-busy={previewing || committing}>
        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-start gap-4 mb-3.5">
          <div>
            <h2 className="text-[1.55rem] font-bold tracking-wide text-[#13263a] m-0">Import hàng loạt sản phẩm</h2>
            <p className="mt-1.5 mb-0 text-[#5d6b82] text-sm">
              Tải file Excel, xem trước dữ liệu hợp lệ và import vào hệ thống chỉ với một lần xác nhận.
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/admin/products/add" className="border border-[#d0d9e4] rounded-lg p-[8px_12px] cursor-pointer bg-[#e8edf3] text-[#0f2233] font-semibold text-sm hover:-translate-y-px transition-all duration-150 inline-flex items-center gap-1.5">
              + Thêm thủ công
            </Link>
            <Link to="/admin/products" className="inline-block no-underline bg-gradient-to-br from-[#10375c] to-[#1c5d96] text-white p-[10px_14px] rounded-xl font-semibold shadow-[0_8px_18px_rgba(16,55,92,0.22)] cursor-pointer hover:-translate-y-px transition-all duration-150 inline-flex items-center gap-1.5">
              Về danh sách sản phẩm
            </Link>
          </div>
        </div>

        <div className="my-[8px_14px] flex flex-col md:flex-row justify-between items-start md:items-center gap-2.5 p-[10px_12px] rounded-xl border border-[#dbe6f3] bg-[#f8fbff]">
          <p className="m-0 text-[#4f6078] text-sm">
            Cột bắt buộc trong file: <strong>{TEMPLATE_COLUMNS.join(", ")}</strong>
          </p>
          <button type="button" className="border border-[#15803d] rounded-lg p-[8px_12px] cursor-pointer bg-[#16a34a] text-white font-semibold text-sm hover:bg-[#15803d] transition-all duration-150 inline-flex items-center gap-1.5" onClick={handleDownloadTemplate}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            Tải file template Excel
          </button>
        </div>

        <p className="mt-1.5 mb-4 text-[#5d6b82] text-sm">Danh mục hiện có trong hệ thống: {categoryTemplateRows.length} danh mục (đã kèm sheet Categories).</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3.5 mb-5.5 items-end">
          <div className="grid gap-2 min-w-0 col-span-1 sm:col-span-2">
            <label htmlFor="product-import-file" className="text-[12px] uppercase tracking-wider text-[#6b7a8d] font-bold block mb-1">File Excel</label>
            <input
              id="product-import-file"
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              className="p-2 bg-[#f8fbff] border-2 border-dashed border-[#b5ccf0] cursor-pointer h-auto w-full rounded-xl text-sm focus:outline-none file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-[#d0d9e4] file:bg-[#e8edf3] file:text-[#0f2233] file:font-semibold file:cursor-pointer hover:file:bg-[#dce6f2] file:transition-all"
            />
            {selectedFileName ? <small className="text-xs text-admin-muted mt-1 block">Đã chọn file: {selectedFileName}</small> : null}
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button type="button" className="border border-[#d0d9e4] rounded-lg p-[8px_12px] cursor-pointer bg-[#e8edf3] text-[#0f2233] font-semibold text-sm hover:-translate-y-px transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5" onClick={handlePreview} disabled={previewing || rows.length === 0}>
            {previewing ? "Đang phân tích..." : "Xem trước dữ liệu"}
          </button>
          <button
            type="button"
            className="inline-block no-underline bg-gradient-to-br from-[#10375c] to-[#1c5d96] text-white p-[10px_14px] rounded-xl font-semibold shadow-[0_8px_18px_rgba(16,55,92,0.22)] cursor-pointer hover:-translate-y-px transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
            onClick={handleCommit}
            disabled={committing || !preview || hasPreviewErrors || !hasPreviewValidRows}
          >
            {committing ? "Đang import..." : "Xác nhận import"}
          </button>
        </div>

        {preview ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 my-4 items-stretch">
              <article className="bg-white border border-[#13263a]/12 rounded-[9px] p-[7px_10px] min-h-[58px] h-full flex flex-col justify-center items-start gap-0.5 shadow-xs">
                <span className="text-[#7b8797] text-[10px] font-semibold leading-none ml-0.75">Tổng dòng</span>
                <strong className="text-lg font-bold leading-none ml-0.75 text-[#0f2233]">{preview.summary?.totalRows || 0}</strong>
              </article>
              <article className="bg-white border border-[#13263a]/12 rounded-[9px] p-[7px_10px] min-h-[58px] h-full flex flex-col justify-center items-start gap-0.5 shadow-xs">
                <span className="text-[#7b8797] text-[10px] font-semibold leading-none ml-0.75">Hợp lệ</span>
                <strong className="text-lg font-bold leading-none ml-0.75 text-[#166534]">{preview.summary?.validRows || 0}</strong>
              </article>
              <article className="bg-white border border-[#13263a]/12 rounded-[9px] p-[7px_10px] min-h-[58px] h-full flex flex-col justify-center items-start gap-0.5 shadow-xs">
                <span className="text-[#7b8797] text-[10px] font-semibold leading-none ml-0.75">Lỗi</span>
                <strong className="text-lg font-bold leading-none ml-0.75 text-[#b42318]">{preview.summary?.errorRows || 0}</strong>
              </article>
            </div>

            <div className="border border-[#e2eaf4] rounded-2xl overflow-hidden bg-white w-full max-w-full mt-4">
              <div className="w-full max-w-full overflow-x-auto bg-white">
                <table className="w-full table-fixed min-w-0 text-[13px] border-collapse bg-white">
                  <thead>
                    <tr>
                      <th className="w-[10%] bg-[#f8fbff] text-[12px] uppercase tracking-wider text-[#6f7f94] font-semibold p-2 break-words whitespace-normal align-middle text-center">Dòng</th>
                      <th className="w-[30%] bg-[#f8fbff] text-[12px] uppercase tracking-wider text-[#6f7f94] font-semibold p-2 break-words whitespace-normal align-middle text-left">Tên sản phẩm</th>
                      <th className="w-[25%] bg-[#f8fbff] text-[12px] uppercase tracking-wider text-[#6f7f94] font-semibold p-2 break-words whitespace-normal align-middle text-left">Danh mục</th>
                      <th className="w-[15%] bg-[#f8fbff] text-[12px] uppercase tracking-wider text-[#6f7f94] font-semibold p-2 break-words whitespace-normal align-middle text-left">Giá</th>
                      <th className="w-[10%] bg-[#f8fbff] text-[12px] uppercase tracking-wider text-[#6f7f94] font-semibold p-2 break-words whitespace-normal align-middle text-left">Tồn kho</th>
                      <th className="w-[10%] bg-[#f8fbff] text-[12px] uppercase tracking-wider text-[#6f7f94] font-semibold p-2 break-words whitespace-normal align-middle text-left">Giảm giá</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedPreviewRows.map((item) => (
                      <tr key={`valid-${item.rowNumber}`} className="transition-colors duration-180 hover:bg-[#f8fbff]">
                        <td className="p-2 break-words whitespace-normal align-middle border-b border-[#edf2f8] text-center">{item.rowNumber}</td>
                        <td className="p-2 break-words whitespace-normal align-middle border-b border-[#edf2f8] text-left">{item.payload?.name}</td>
                        <td className="p-2 break-words whitespace-normal align-middle border-b border-[#edf2f8] text-left">{item.payload?.category}</td>
                        <td className="p-2 break-words whitespace-normal align-middle border-b border-[#edf2f8] text-left">{Number(item.payload?.price || 0).toLocaleString("vi-VN")} đ</td>
                        <td className="p-2 break-words whitespace-normal align-middle border-b border-[#edf2f8] text-left">{item.payload?.stock}</td>
                        <td className="p-2 break-words whitespace-normal align-middle border-b border-[#edf2f8] text-left">{item.payload?.discountPercent}%</td>
                      </tr>
                    ))}
                    {parsedPreviewRows.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center text-[#657589] p-6">
                          Không có dòng hợp lệ để xem trước.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            {preview.errorRows?.length ? (
              <div className="border border-[#e2eaf4] rounded-2xl overflow-hidden bg-white w-full max-w-full mt-4">
                <div className="w-full max-w-full overflow-x-auto bg-white">
                  <table className="w-full table-fixed min-w-0 text-[13px] border-collapse bg-white">
                    <thead>
                      <tr>
                        <th className="w-[15%] bg-[#f8fbff] text-[12px] uppercase tracking-wider text-[#6f7f94] font-semibold p-2 break-words whitespace-normal align-middle text-center">Dòng lỗi</th>
                        <th className="w-[85%] bg-[#f8fbff] text-[12px] uppercase tracking-wider text-[#6f7f94] font-semibold p-2 break-words whitespace-normal align-middle text-left">Chi tiết</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.errorRows.slice(0, PREVIEW_LIMIT).map((item) => (
                        <tr key={`error-${item.rowNumber}`} className="transition-colors duration-180 hover:bg-[#f8fbff]">
                          <td className="p-2 break-words whitespace-normal align-middle border-b border-[#edf2f8] text-center">{item.rowNumber}</td>
                          <td className="p-2 break-words whitespace-normal align-middle border-b border-[#edf2f8] text-left">{Array.isArray(item.errors) ? item.errors.join(" | ") : "Dữ liệu không hợp lệ"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </section>
    </main>
  );
}

export default AdminBulkImportProductPage;
