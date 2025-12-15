// app/orders/page.jsx
import OrdersView from "./OrdersView";

const ordersData = {
  order: [
    {
      table_number: 6,
      id: "ORD-20251211-001",
      status: "completed",
      created_at: "2025-12-10T12:37:47.604Z",
      session_id: "e028c916-51de-4354-b604-ecc5d2d2c0af",
      opened_at: "2025-12-10T12:37:36.049Z",
      closed_at: "2025-12-10T12:38:15.279Z",
      items: [
        { menu_item_name: "ปลากระพง", quantity: 1, price: 399 },
        { menu_item_name: "ข้าวเหนียวมะม่วง", quantity: 1, price: 99 },
      ],
      total: "498.00",
    },
    {
      table_number: 2,
      id: "ORD-20251206-003",
      status: "completed",
      created_at: "2025-12-06T02:00:02.787Z",
      session_id: "c62bc34e-db39-4a1f-a355-4664bdfdcb44",
      opened_at: "2025-12-06T01:59:49.162Z",
      closed_at: "2025-12-06T02:00:29.524Z",
      items: [
        { menu_item_name: "ส้มตำ", quantity: 1, price: 190 },
        { menu_item_name: "เบียร์สิงห์", quantity: 1, price: 80 },
      ],
      total: "270.00",
    },
    {
      table_number: 2,
      id: "ORD-20251206-002",
      status: "completed",
      created_at: "2025-12-06T01:59:58.748Z",
      session_id: "c62bc34e-db39-4a1f-a355-4664bdfdcb44",
      opened_at: "2025-12-06T01:59:49.162Z",
      closed_at: "2025-12-06T02:00:29.524Z",
      items: [
        { menu_item_name: "ต้มยำกุ้ง", quantity: 1, price: 190 },
        { menu_item_name: "สตอเบอรี่ช็อตเค้ก", quantity: 1, price: 69 },
      ],
      total: "259.00",
    },
    {
      table_number: 6,
      id: "ORD-20251206-001",
      status: "completed",
      created_at: "2025-12-06T01:48:29.712Z",
      session_id: null,
      opened_at: null,
      closed_at: null,
      items: [{ menu_item_name: "ต้มยำกุ้ง", quantity: 1, price: 190 }],
      total: "190.00",
    },
  ],
};

export default function OrdersPage() {
  return <OrdersView orders={ordersData.order} />;
}
