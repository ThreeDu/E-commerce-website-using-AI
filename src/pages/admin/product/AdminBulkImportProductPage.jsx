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
import "../../../css/admin/products.css";

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
    <main className="container page-content admin-products-page">
      <section className="hero-card dashboard-surface admin-page-enter" aria-busy={previewing || committing}>
        <div className="dashboard-header-row">
          <div>
            <h2>Import hàng loạt sản phẩm</h2>
            <p className="dashboard-subtitle">
              Tải file Excel, xem trước dữ liệu hợp lệ và import vào hệ thống chỉ với một lần xác nhận.
            </p>
          </div>
          <div className="bulk-action-buttons">
            <Link to="/admin/products/add" className="secondary-btn">
              + Thêm thủ công
            </Link>
            <Link to="/admin/products" className="primary-link-btn">
              Về danh sách sản phẩm
            </Link>
          </div>
        </div>

        <div className="bulk-action-bar product-import-template">
          <p>
            Cột bắt buộc trong file: <strong>{TEMPLATE_COLUMNS.join(", ")}</strong>
          </p>
          <button type="button" className="secondary-btn excel-btn" onClick={handleDownloadTemplate}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            Tải file template Excel
          </button>
        </div>

        <p className="dashboard-subtitle">Danh mục hiện có trong hệ thống: {categoryTemplateRows.length} danh mục (đã kèm sheet Categories).</p>

        <div className="dashboard-filter-bar">
          <div className="filter-control search-control">
            <label htmlFor="product-import-file">File Excel</label>
            <input
              id="product-import-file"
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              className="custom-file-input"
            />
            {selectedFileName ? <small>Đã chọn file: {selectedFileName}</small> : null}
          </div>
        </div>

        <div className="bulk-action-buttons">
          <button type="button" className="secondary-btn" onClick={handlePreview} disabled={previewing || rows.length === 0}>
            {previewing ? "Đang phân tích..." : "Xem trước dữ liệu"}
          </button>
          <button
            type="button"
            className="primary-link-btn"
            onClick={handleCommit}
            disabled={committing || !preview || hasPreviewErrors || !hasPreviewValidRows}
          >
            {committing ? "Đang import..." : "Xác nhận import"}
          </button>
        </div>

        {preview ? (
          <>
            <div className="dashboard-metric-grid import-metric-grid">
              <article className="metric-card">
                <span>Tổng dòng</span>
                <strong>{preview.summary?.totalRows || 0}</strong>
              </article>
              <article className="metric-card success">
                <span>Hợp lệ</span>
                <strong>{preview.summary?.validRows || 0}</strong>
              </article>
              <article className="metric-card danger">
                <span>Lỗi</span>
                <strong>{preview.summary?.errorRows || 0}</strong>
              </article>
            </div>

            <div className="dashboard-table-card">
              <div className="users-table-wrap">
                <table className="users-table dashboard-table">
                  <thead>
                    <tr>
                      <th>Dòng</th>
                      <th>Tên sản phẩm</th>
                      <th>Danh mục</th>
                      <th>Giá</th>
                      <th>Tồn kho</th>
                      <th>Giảm giá</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedPreviewRows.map((item) => (
                      <tr key={`valid-${item.rowNumber}`}>
                        <td>{item.rowNumber}</td>
                        <td>{item.payload?.name}</td>
                        <td>{item.payload?.category}</td>
                        <td>{Number(item.payload?.price || 0).toLocaleString("vi-VN")} đ</td>
                        <td>{item.payload?.stock}</td>
                        <td>{item.payload?.discountPercent}%</td>
                      </tr>
                    ))}
                    {parsedPreviewRows.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="table-empty-cell">
                          Không có dòng hợp lệ để xem trước.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            {preview.errorRows?.length ? (
              <div className="dashboard-table-card product-import-errors">
                <div className="users-table-wrap">
                  <table className="users-table dashboard-table">
                    <thead>
                      <tr>
                        <th>Dòng lỗi</th>
                        <th>Chi tiết</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.errorRows.slice(0, PREVIEW_LIMIT).map((item) => (
                        <tr key={`error-${item.rowNumber}`}>
                          <td>{item.rowNumber}</td>
                          <td>{Array.isArray(item.errors) ? item.errors.join(" | ") : "Dữ liệu không hợp lệ"}</td>
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
