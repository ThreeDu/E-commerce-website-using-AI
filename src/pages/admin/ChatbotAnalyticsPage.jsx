import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';

function ChatbotAnalyticsPage() {
  const { auth } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const res = await fetch('/api/admin/chatbot-analytics/overview', {
          headers: {
            Authorization: `Bearer ${auth?.token}`,
          },
        });
        const result = await res.json();
        if (result.success) {
          setData(result.data);
        }
      } catch (err) {
        console.error('Failed to fetch chatbot analytics:', err);
      } finally {
        setLoading(false);
      }
    }

    if (auth?.token) fetchAnalytics();
  }, [auth]);

  if (loading) {
    return <div className="p-8 text-center text-gray-400">Đang tải dữ liệu thống kê...</div>;
  }

  if (!data) {
    return <div className="p-8 text-center text-red-400">Không thể tải dữ liệu thống kê Chatbot.</div>;
  }

  return (
    <div className="p-6 bg-slate-900 text-slate-100 min-h-screen">
      <h1 className="text-2xl font-bold mb-6 text-emerald-400">📊 Thống Kê Hoạt Động AI Chatbot</h1>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
          <p className="text-slate-400 text-sm">Tổng Phiên Chat</p>
          <p className="text-3xl font-extrabold text-white mt-1">{data.totalSessions}</p>
        </div>
        <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
          <p className="text-slate-400 text-sm">Hiển Thị Gợi Ý (Impressions)</p>
          <p className="text-3xl font-extrabold text-blue-400 mt-1">{data.impressions}</p>
        </div>
        <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
          <p className="text-slate-400 text-sm">Click Sản Phẩm (CTR)</p>
          <p className="text-3xl font-extrabold text-yellow-400 mt-1">{data.ctr}</p>
        </div>
        <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
          <p className="text-slate-400 text-sm">Thêm Vào Giỏ (Conversion)</p>
          <p className="text-3xl font-extrabold text-emerald-400 mt-1">{data.conversionRate}</p>
        </div>
      </div>

      {/* Lists */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-5 bg-slate-800 rounded-xl border border-slate-700">
          <h2 className="text-lg font-bold mb-4 text-slate-200">🔥 Top Chủ Đề Khách Tìm Kiếm</h2>
          {data.topQueries.length === 0 ? (
            <p className="text-slate-500 text-sm">Chưa có dữ liệu tìm kiếm.</p>
          ) : (
            <ul className="divide-y divide-slate-700">
              {data.topQueries.map((q, i) => (
                <li key={i} className="py-2.5 flex justify-between items-center text-sm">
                  <span className="text-slate-300">"{q._id}"</span>
                  <span className="bg-slate-700 px-2.5 py-1 rounded-full text-xs font-medium text-emerald-400">
                    {q.count} lượt
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="p-5 bg-slate-800 rounded-xl border border-slate-700">
          <h2 className="text-lg font-bold mb-4 text-slate-200">⭐ Top Sản Phẩm Được AI Gợi Ý</h2>
          {data.topProducts.length === 0 ? (
            <p className="text-slate-500 text-sm">Chưa có sản phẩm gợi ý.</p>
          ) : (
            <ul className="divide-y divide-slate-700">
              {data.topProducts.map((item, i) => (
                <li key={i} className="py-2.5 flex justify-between items-center text-sm">
                  <span className="text-slate-300 font-medium">{item.productInfo?.name || item._id}</span>
                  <span className="bg-slate-700 px-2.5 py-1 rounded-full text-xs font-medium text-blue-400">
                    {item.impressions} lần
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default ChatbotAnalyticsPage;
