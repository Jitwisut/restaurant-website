"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import {
  Search,
  Edit2,
  Trash2,
  UserPlus,
  Users,
  Shield,
  ChefHat,
  Eye,
  EyeOff,
} from "lucide-react";
import axios from "axios";

const AdminUserManagement = () => {
  const router = useRouter();
  const [users, setUsers] = useState([]); // ลบ user จำลองออก
  const [role, setRole] = useState({});
  const [total, setTotal] = useState();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [originuser, setOriginuser] = useState("");

  // Form States
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userRole, setUserRole] = useState("user");

  useEffect(() => {
    const admin = async () => {
      const url = "http://localhost:4000";
      try {
        const res = await axios.get(`${url}/middleware/admin`, {
          withCredentials: true,
        });
        console.log("Success");
      } catch (error) {
        if (error.response?.status === 401) {
          console.log("ยังไม่ได้ login");
          router.push("/");
        } else if (error.response?.status === 403) {
          console.log("ไม่ใช่ admin");
          router.push("/");
        } else {
          console.log("เกิดข้อผิดพลาดอื่น:", error);
        }
      }
    };

    admin();
    fetchUser();
  }, [router]);

  const fetchUser = async () => {
    const url = "http://localhost:4000";
    try {
      const res = await axios.get(`${url}/admin/getuser`, {
        withCredentials: true,
      });
      if (res.status === 200) {
        setUsers(res.data.user);
        setTotal(res.data.count);
        setRole(res.data.roles);
      }
    } catch (error) {
      console.error("Fetch error:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = "http://localhost:4000";
    try {
      const res = await axios.post(
        `${url}/admin/createuser`,
        {
          username,
          password,
          email,
          role: userRole,
        },
        { withCredentials: true }
      );

      if (res.status === 201) {
        Swal.fire({
          icon: "success",
          title: "สมัครสมาชิกสำเร็จ",
          text: "คุณสามารถเข้าสู่ระบบได้เลย!",
        });
        fetchUser();
        setUsername("");
        setEmail("");
        setPassword("");
        setUserRole("user");
        setShowCreateForm(false);
      }
    } catch (error) {
      console.error(error);
      Swal.fire({
        icon: "error",
        title: "เกิดข้อผิดพลาด",
        text: "ไม่สามารถสร้างผู้ใช้ได้ กรุณาลองใหม่อีกครั้ง",
      });
    }
  };

  const updateUser = async () => {
    const url = "http://localhost:4000";
    try {
      const res = await axios.post(
        `${url}/admin/updateuser`,
        {
          username,
          email,
          role: userRole,
          originuser,
        },
        { withCredentials: true }
      );

      if (res.status === 200) {
        Swal.fire({
          icon: "success",
          title: "แก้ไขสำเร็จ",
        });
        fetchUser();
        cancelEdit();
      }
    } catch (error) {
      console.error("Update error:", error);
    }
  };

  const deleteUser = (userId) => {
    if (confirm("คุณแน่ใจหรือไม่ที่จะลบผู้ใช้นี้?")) {
      setUsers(users.filter((user) => user.id !== userId));
    }
  };

  const startEdit = (user) => {
    setEditingUser(user);
    setUsername(user.username);
    setEmail(user.email);
    setUserRole(user.role);
    setOriginuser(user.username);
  };

  const cancelEdit = () => {
    setEditingUser(null);
    setUsername("");
    setEmail("");
    setUserRole("user");
  };

  const toggleUserStatus = (userId) => {
    setUsers(
      users.map((user) =>
        user.id === userId
          ? {
              ...user,
              status: user.status === "active" ? "inactive" : "active",
            }
          : user
      )
    );
  };

  const filteredUsers = users.filter((user) => {
    const matchSearch =
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchRole = filterRole === "all" || user.role === filterRole;
    const matchStatus = filterStatus === "all" || user.status === filterStatus;
    return matchSearch && matchRole && matchStatus;
  });

  const getRoleIcon = (role) => {
    switch (role) {
      case "admin":
        return <Shield className="w-4 h-4 text-red-500" />;
      case "kitchen":
        return <ChefHat className="w-4 h-4 text-orange-500" />;
      default:
        return <Users className="w-4 h-4 text-blue-500" />;
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case "admin":
        return "bg-red-100 text-red-800";
      case "kitchen":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-blue-100 text-blue-800";
    }
  };

  const stats = {
    totals: users.length,
    admin: users.filter((u) => u.role === "admin").length,
    kitchen: users.filter((u) => u.role === "kitchen").length,
    user: users.filter((u) => u.role === "user").length,
    active: users.filter((u) => u.status === "active").length,
    inactive: users.filter((u) => u.status === "inactive").length,
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">จัดการผู้ใช้งาน</h1>

        {/* สถิติ */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
          <StatCard label="ทั้งหมด" value={total} />
          <StatCard label="ใช้งานอยู่" value={stats.active} color="green" />
          <StatCard label="ไม่ใช้งาน" value={stats.inactive} color="gray" />
          <StatCard label="Admin" value={role.admin} color="red" />
          <StatCard label="Kitchen" value={role.kitchen} color="orange" />
          <StatCard label="User" value={role.user} color="blue" />
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              className="w-full pl-10 pr-4 py-2 border rounded-md"
              placeholder="ค้นหา username หรือ email"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="border px-3 py-2 rounded-md"
          >
            <option value="all">ทุก Role</option>
            <option value="admin">Admin</option>
            <option value="kitchen">Kitchen</option>
            <option value="user">User</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border px-3 py-2 rounded-md"
          >
            <option value="all">ทุกสถานะ</option>
            <option value="active">ใช้งานอยู่</option>
            <option value="inactive">ไม่ใช้งาน</option>
          </select>
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" /> เพิ่มผู้ใช้
          </button>
        </div>

        {/* ฟอร์มสร้างหรือแก้ไขผู้ใช้ */}
        {(showCreateForm || editingUser) && (
          <div className="bg-white border rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">
              {editingUser ? "แก้ไขผู้ใช้" : "เพิ่มผู้ใช้ใหม่"}
            </h2>
            <form className="grid md:grid-cols-2 gap-4">
              <input
                className="border p-2 rounded-md"
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <input
                className="border p-2 rounded-md"
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {!editingUser && (
                <input
                  className="border p-2 rounded-md"
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              )}
              <select
                value={userRole}
                onChange={(e) => setUserRole(e.target.value)}
                className="border p-2 rounded-md"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
                <option value="kitchen">Kitchen</option>
              </select>
            </form>
            <div className="mt-4 flex gap-2">
              <button
                onClick={editingUser ? updateUser : handleSubmit}
                className="bg-blue-600 text-white px-4 py-2 rounded-md"
              >
                {editingUser ? "บันทึกการแก้ไข" : "สร้างผู้ใช้"}
              </button>
              <button
                onClick={
                  editingUser ? cancelEdit : () => setShowCreateForm(false)
                }
                className="bg-gray-500 text-white px-4 py-2 rounded-md"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        )}

        {/* ตารางแสดงผู้ใช้งาน */}
        <div className="bg-white rounded-lg shadow-sm border overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs text-gray-500">
                  ผู้ใช้งาน
                </th>
                <th className="px-6 py-3 text-left text-xs text-gray-500">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs text-gray-500">
                  สถานะ
                </th>
                <th className="px-6 py-3 text-left text-xs text-gray-500">
                  สร้างเมื่อ
                </th>
                <th className="px-6 py-3 text-right text-xs text-gray-500">
                  จัดการ
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td className="px-6 py-3">
                    {user.username}
                    <br />
                    <span className="text-xs text-gray-500">{user.email}</span>
                  </td>
                  <td className="px-6 py-3">
                    {getRoleIcon(user.role)}{" "}
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${getRoleColor(
                        user.role
                      )}`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        user.status === "active"
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {user.status === "active" ? "ใช้งานอยู่" : "ไม่ใช้งาน"}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-500">
                    {user.createdAt}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => toggleUserStatus(user.id)}
                        title="เปลี่ยนสถานะ"
                      >
                        {user.status === "active" ? <EyeOff /> : <Eye />}
                      </button>
                      <button onClick={() => startEdit(user)} title="แก้ไข">
                        <Edit2 />
                      </button>
                      <button onClick={() => deleteUser(user.id)} title="ลบ">
                        <Trash2 className="text-red-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan="5" className="text-center py-4 text-gray-500">
                    ไม่พบผู้ใช้งาน
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, color = "gray" }) => (
  <div className="bg-white p-4 border rounded-lg text-center shadow-sm">
    <div className={`text-2xl font-bold text-${color}-600`}>{value ?? 0}</div>
    <div className="text-sm text-gray-500">{label}</div>
  </div>
);

export default AdminUserManagement;
