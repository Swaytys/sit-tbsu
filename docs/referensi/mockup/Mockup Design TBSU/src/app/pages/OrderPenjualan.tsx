import React, { useState } from 'react';
import { Clock, Search, Filter, User, MapPin, Package, CheckCircle2, AlertCircle, ShoppingCart, ChevronRight } from 'lucide-react';

const mockOrders = [
  { 
    id: 'ORD-260406-004', 
    time: '10:30', 
    customer: 'Bpk. Ahmad', 
    type: 'Pengantaran', 
    items: 5, 
    total: 3500000, 
    status: 'Menunggu', 
    priority: 'high',
    staff: 'Rini (Sales)'
  },
  { 
    id: 'ORD-260406-003', 
    time: '10:15', 
    customer: 'Tukang (Bp. Joko)', 
    type: 'Langsung', 
    items: 2, 
    total: 450000, 
    status: 'Menunggu', 
    priority: 'normal',
    staff: 'Budi (Sales)'
  },
  { 
    id: 'ORD-260406-002', 
    time: '09:45', 
    customer: 'PT. Bangun Sentosa', 
    type: 'Pengantaran', 
    items: 12, 
    total: 12500000, 
    status: 'Diproses', 
    priority: 'normal',
    staff: 'Siti (Sales)'
  },
  { 
    id: 'ORD-260406-001', 
    time: '09:20', 
    customer: 'Ibu Ratna', 
    type: 'Langsung', 
    items: 1, 
    total: 85000, 
    status: 'Selesai', 
    priority: 'normal',
    staff: 'Kasir Utama'
  },
];

const mockOrderDetails = [
  { name: 'Semen Gresik 40kg', qty: 20, unit: 'Sak', price: 55000, total: 1100000 },
  { name: 'Besi Beton Polos 8mm', qty: 30, unit: 'Btg', price: 45000, total: 1350000 },
  { name: 'Pipa PVC Maspion 3/4"', qty: 10, unit: 'Btg', price: 22000, total: 220000 },
  { name: 'Cat Tembok Dulux 5kg', qty: 2, unit: 'Pail', price: 185000, total: 370000 },
  { name: 'Kuas Cat 3"', qty: 4, unit: 'Pcs', price: 15000, total: 60000 },
];

export function OrderPenjualan() {
  const [selectedOrder, setSelectedOrder] = useState(mockOrders[0].id);

  return (
    <div className="p-6 h-[calc(100vh-4rem)] flex flex-col animate-in fade-in duration-500 max-w-[1400px] mx-auto">
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Antrean Order</h1>
          <p className="text-slate-500 mt-1 text-sm">Daftar pesanan dari sales yang menunggu proses pembayaran</p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm transition-colors flex items-center gap-2">
            <Search className="w-4 h-4" /> Cari Order
          </button>
          <button className="px-4 py-2 bg-blue-600 border border-transparent rounded-lg text-sm font-medium text-white hover:bg-blue-700 shadow-sm transition-colors flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" /> Buat Order Baru
          </button>
        </div>
      </div>

      <div className="flex flex-1 gap-6 overflow-hidden">
        {/* Left Pane: Queue List */}
        <div className="w-1/3 flex flex-col bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" /> Antrean Aktif (3)
            </h2>
            <button className="p-1.5 text-slate-500 hover:bg-slate-200 rounded-md transition-colors">
              <Filter className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50/50">
            {mockOrders.map((order) => (
              <div 
                key={order.id} 
                onClick={() => setSelectedOrder(order.id)}
                className={`relative p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedOrder === order.id 
                    ? 'bg-blue-50/50 border-blue-500 shadow-sm' 
                    : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-sm'
                } ${order.status === 'Selesai' ? 'opacity-60' : ''}`}
              >
                {order.priority === 'high' && order.status !== 'Selesai' && (
                  <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Prioritas
                  </div>
                )}
                
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold text-slate-800 text-sm">{order.id}</span>
                  <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {order.time}
                  </span>
                </div>
                
                <div className="space-y-1.5 mb-3">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <User className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="truncate font-medium">{order.customer}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className={`px-2 py-0.5 rounded-md font-medium ${
                      order.type === 'Pengantaran' ? 'bg-indigo-50 text-indigo-700' : 'bg-orange-50 text-orange-700'
                    }`}>
                      {order.type}
                    </span>
                    <span className="text-slate-500 flex items-center gap-1">
                      <Package className="w-3 h-3" /> {order.items} Item
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    order.status === 'Menunggu' ? 'bg-amber-100 text-amber-700' :
                    order.status === 'Diproses' ? 'bg-blue-100 text-blue-700' :
                    'bg-emerald-100 text-emerald-700'
                  }`}>
                    {order.status}
                  </span>
                  <span className="font-bold text-slate-800">Rp {order.total.toLocaleString('id-ID')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Pane: Selected Order Details */}
        <div className="w-2/3 flex flex-col bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          {/* Header */}
          <div className="p-5 border-b border-slate-200 bg-white shrink-0 flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-xl font-bold text-slate-800">Order: ORD-260406-004</h2>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">
                  Menunggu Kasir
                </span>
              </div>
              <p className="text-sm text-slate-500 flex items-center gap-4 mt-2">
                <span className="flex items-center gap-1"><User className="w-4 h-4" /> Bpk. Ahmad (Pengantaran)</span>
                <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> Dibuat oleh: Rini (10:30)</span>
              </p>
            </div>
            
            <button className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-bold shadow-sm hover:bg-blue-700 focus:ring-4 focus:ring-blue-100 transition-all flex items-center gap-2">
              Proses ke Pembayaran <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Delivery Info (if applicable) */}
          <div className="px-5 py-4 border-b border-slate-100 bg-indigo-50/30 shrink-0">
            <h3 className="text-xs font-bold text-indigo-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <MapPin className="w-4 h-4" /> Informasi Pengiriman
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500 text-xs mb-0.5">Alamat Tujuan</p>
                <p className="font-medium text-slate-800">Jl. Pembangunan No. 45, Komplek Asri, Sidoarjo</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-0.5">Catatan Pengiriman</p>
                <p className="text-slate-800">Kirim hari ini sebelum jam 15:00. Telepon sebelum sampai.</p>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="flex-1 overflow-auto bg-slate-50 p-5">
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50/80 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4 text-xs font-bold text-slate-600 uppercase w-12 text-center">No</th>
                    <th className="py-2.5 px-4 text-xs font-bold text-slate-600 uppercase">Nama Barang</th>
                    <th className="py-2.5 px-4 text-xs font-bold text-slate-600 uppercase text-center">Qty</th>
                    <th className="py-2.5 px-4 text-xs font-bold text-slate-600 uppercase text-right">Harga Satuan</th>
                    <th className="py-2.5 px-4 text-xs font-bold text-slate-600 uppercase text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {mockOrderDetails.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-3 px-4 text-center text-slate-500">{idx + 1}</td>
                      <td className="py-3 px-4 font-medium text-slate-800">{item.name}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded">{item.qty} {item.unit}</span>
                      </td>
                      <td className="py-3 px-4 text-right text-slate-600 tabular-nums">Rp {item.price.toLocaleString('id-ID')}</td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-800 tabular-nums">Rp {item.total.toLocaleString('id-ID')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer Totals */}
          <div className="p-5 border-t border-slate-200 bg-white shrink-0">
            <div className="flex justify-between items-end max-w-sm ml-auto">
              <div className="space-y-2 text-right flex-1 pr-6">
                <p className="text-sm text-slate-500">Subtotal Item (5)</p>
                <p className="text-sm text-slate-500">Biaya Pengiriman</p>
                <p className="text-sm font-bold text-slate-800 pt-2 border-t border-slate-100">Total Tagihan</p>
              </div>
              <div className="space-y-2 text-right">
                <p className="text-sm font-medium text-slate-700 tabular-nums">Rp 3.100.000</p>
                <p className="text-sm font-medium text-slate-700 tabular-nums">Rp 400.000</p>
                <p className="text-xl font-bold text-blue-700 pt-2 border-t border-slate-100 tabular-nums">Rp 3.500.000</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
