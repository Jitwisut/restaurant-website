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
  Upload,
  X,
  Plus,
  Image,
  DollarSign,
  FileText,
  Tag,
  Filter,
  Download,
  Settings,
  TrendingUp,
  Activity,
} from "lucide-react";
import axios from "axios";

const AdminUserManagement = () => {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [role, setRole] = useState({});
  const [total, setTotal] = useState();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [originuser, setOriginuser] = useState("");

  // Menu Upload States
  const [showMenuUpload, setShowMenuUpload] = useState(false);
  const [menuData, setMenuData] = useState({
    name: "",
    description: "",
    price: "",
    image: "",
    category: "",
  });
  const [imagePreview, setImagePreview] = useState(null);

  // Form States
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userRole, setUserRole] = useState("user");
  const baseurl = process.env.NEXT_PUBLIC_BACKEND_URL;

  useEffect(() => {
    const admin = async () => {
      const token = sessionStorage.getItem("auth");
      try {
        const res = await axios.get(`${baseurl}/middleware/admin`, {
          headers: { Authorization: `Bearer ${token}` },
          withCredentials: true,
        });
        console.log("Success");
      } catch (error) {
        if (error.response?.status === 401) {
          console.log("ยังไม่ได้ login");
          console.warn("Error:", error);
          router.push("/");
        } else if (error.response?.status === 403) {
          console.log("ไม่ใช่ admin");
          console.warn("Error:", error);
          router.push("/");
        } else {
          console.log("เกิดข้อผิดพลาดอื่น:", error);
          console.warn("Error:", error);
        }
      }
    };

    admin();
    fetchUser();
  }, [router]);

  const fetchUser = async () => {
    try {
      const res = await axios.get(`${baseurl}/admin/getuser`, {
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

    try {
      const res = await axios.post(
        `${baseurl}/admin/createuser`,
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
        text: error.response.data.message,
      });
    }
  };

  const updateUser = async () => {
    try {
      const res = await axios.post(
        `${baseurl}/admin/updateuser`,
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

  // Menu Upload Functions
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setMenuData({ ...menuData, image: file });
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handledeleteSubmit = async (user) => {
    const res = await axios.post(`${baseurl}/admin/deleteuser`, {
      username: user,
    });
    if (res.status === 201) {
      Swal.fire({
        icon: "success",
        title: "ลบข้อมูลผู้ใช้เรียบร้อย",
        text: "ผู้ใช้ถูกลบออกจากระบบแล้ว",
      });
    }
    fetchUser();
  };

  const handleMenuSubmit = async (e) => {
    e.preventDefault();
    console.log("name:", menuData.name);
    console.log("image:", menuData.image);

    try {
      const res = await axios.post(`${baseurl}/admin/upload-menu`, menuData, {
        withCredentials: true,
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res.status === 200) {
        Swal.fire({
          icon: "success",
          title: "อัพโหลดเมนูสำเร็จ",
          text: "เมนูใหม่ถูกเพิ่มเข้าระบบแล้ว",
        });
      }

      setMenuData({
        name: "",
        description: "",
        price: "",
        image: "",
      });
      setImagePreview(null);
      setShowMenuUpload(false);
    } catch (error) {
      console.error("Upload error:", error);
      Swal.fire({
        icon: "error",
        title: "เกิดข้อผิดพลาด",
        text: "ไม่สามารถอัพโหลดเมนูได้ กรุณาลองใหม่อีกครั้ง",
      });
    }
  };

  const resetMenuForm = () => {
    setMenuData({
      name: "",
      description: "",
      price: "",
      category: "",
      ingredients: "",
      image: null,
      isAvailable: true,
    });
    setImagePreview(null);
    setShowMenuUpload(false);
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
        return "bg-gradient-to-r from-red-100 to-red-200 text-red-800 border border-red-200";
      case "kitchen":
        return "bg-gradient-to-r from-orange-100 to-orange-200 text-orange-800 border border-orange-200";
      default:
        return "bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 border border-blue-200";
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                จัดการผู้ใช้งาน
              </h1>
              <p className="text-slate-600 mt-2">
                ระบบบริหารจัดการผู้ใช้งานและเมนูอาหาร
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button className="p-2 rounded-xl bg-white shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105">
                <Settings className="w-5 h-5 text-slate-600" />
              </button>
              <button className="p-2 rounded-xl bg-white shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105">
                <Download className="w-5 h-5 text-slate-600" />
              </button>
            </div>
          </div>
        </div>

        {/* Enhanced Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
          <StatCard
            label="ทั้งหมด"
            value={total}
            icon={<Users className="w-6 h-6" />}
            color="slate"
            trend="+12%"
          />
          <StatCard
            label="ใช้งานอยู่"
            value={stats.active}
            icon={<Activity className="w-6 h-6" />}
            color="emerald"
            trend="+8%"
          />
          <StatCard
            label="ไม่ใช้งาน"
            value={stats.inactive}
            icon={<EyeOff className="w-6 h-6" />}
            color="slate"
            trend="-2%"
          />
          <StatCard
            label="Admin"
            value={role.admin}
            icon={<Shield className="w-6 h-6" />}
            color="red"
          />
          <StatCard
            label="Kitchen"
            value={role.kitchen}
            icon={<ChefHat className="w-6 h-6" />}
            color="orange"
          />
          <StatCard
            label="User"
            value={role.user}
            icon={<Users className="w-6 h-6" />}
            color="blue"
          />
        </div>

        {/* Enhanced Search & Filter Bar */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 mb-6 backdrop-blur-sm">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-slate-50 hover:bg-white"
                placeholder="ค้นหา username หรือ email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex gap-3">
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  className="pl-10 pr-8 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 bg-slate-50 hover:bg-white transition-all duration-200"
                >
                  <option value="all">ทุก Role</option>
                  <option value="admin">Admin</option>
                  <option value="kitchen">Kitchen</option>
                  <option value="user">User</option>
                </select>
              </div>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 bg-slate-50 hover:bg-white transition-all duration-200"
              >
                <option value="all">ทุกสถานะ</option>
                <option value="active">ใช้งานอยู่</option>
                <option value="inactive">ไม่ใช้งาน</option>
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowCreateForm(true)}
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-3 rounded-xl flex items-center gap-2 transition-all duration-200 hover:shadow-lg hover:scale-105"
              >
                <UserPlus className="w-4 h-4" />
                เพิ่มผู้ใช้
              </button>
              <button
                onClick={() => setShowMenuUpload(true)}
                className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white px-6 py-3 rounded-xl flex items-center gap-2 transition-all duration-200 hover:shadow-lg hover:scale-105"
              >
                <Upload className="w-4 h-4" />
                อัพโหลดเมนู
              </button>
            </div>
          </div>
        </div>

        {/* Enhanced User Form */}
        {(showCreateForm || editingUser) && (
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 mb-6 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-100 rounded-xl">
                <UserPlus className="w-6 h-6 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800">
                {editingUser ? "แก้ไขข้อมูลผู้ใช้" : "เพิ่มผู้ใช้ใหม่"}
              </h2>
            </div>

            <form className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Username
                </label>
                <input
                  className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-slate-50 hover:bg-white"
                  type="text"
                  placeholder="กรอก Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Email
                </label>
                <input
                  className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-slate-50 hover:bg-white"
                  type="email"
                  placeholder="กรอก Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {!editingUser && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    Password
                  </label>
                  <input
                    className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-slate-50 hover:bg-white"
                    type="password"
                    placeholder="กรอก Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Role
                </label>
                <select
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value)}
                  className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-slate-50 hover:bg-white"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  <option value="kitchen">Kitchen</option>
                </select>
              </div>
            </form>

            <div className="mt-8 flex gap-4">
              <button
                onClick={editingUser ? updateUser : handleSubmit}
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-8 py-3 rounded-xl transition-all duration-200 hover:shadow-lg hover:scale-105 flex items-center gap-2"
              >
                {editingUser ? "บันทึกการแก้ไข" : "สร้างผู้ใช้"}
              </button>
              <button
                onClick={
                  editingUser ? cancelEdit : () => setShowCreateForm(false)
                }
                className="bg-slate-500 hover:bg-slate-600 text-white px-8 py-3 rounded-xl transition-all duration-200 hover:shadow-lg"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        )}

        {/* Enhanced Menu Upload Modal */}
        {showMenuUpload && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex justify-between items-center p-6 border-b border-slate-200">
                <h2 className="text-2xl font-bold flex items-center gap-3 text-slate-800">
                  <div className="p-2 bg-emerald-100 rounded-xl">
                    <Upload className="w-6 h-6 text-emerald-600" />
                  </div>
                  อัพโหลดเมนูอาหาร
                </h2>
                <button
                  onClick={resetMenuForm}
                  className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-xl transition-all duration-200"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleMenuSubmit} className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-3">
                    <FileText className="w-4 h-4 inline mr-2" />
                    ชื่อเมนู *
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 bg-slate-50 hover:bg-white"
                    placeholder="กรอกชื่อเมนูอาหาร"
                    value={menuData.name}
                    onChange={(e) =>
                      setMenuData({ ...menuData, name: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-3">
                    <FileText className="w-4 h-4 inline mr-2" />
                    รายละเอียด
                  </label>
                  <textarea
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 bg-slate-50 hover:bg-white"
                    rows="3"
                    placeholder="รายละเอียดของเมนูอาหาร"
                    value={menuData.description}
                    onChange={(e) =>
                      setMenuData({ ...menuData, description: e.target.value })
                    }
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-3">
                      <DollarSign className="w-4 h-4 inline mr-2" />
                      ราคา (บาท) *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 bg-slate-50 hover:bg-white"
                      placeholder="0.00"
                      value={menuData.price}
                      onChange={(e) =>
                        setMenuData({ ...menuData, price: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-3">
                      <Tag className="w-4 h-4 inline mr-2" />
                      หมวดหมู่ *
                    </label>
                    <select
                      required
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 bg-slate-50 hover:bg-white"
                      value={menuData.category}
                      onChange={(e) =>
                        setMenuData({ ...menuData, category: e.target.value })
                      }
                    >
                      <option value="">เลือกหมวดหมู่</option>
                      <option value="appetizer">อาหารว่าง</option>
                      <option value="main">อาหารจานหลัก</option>
                      <option value="dessert">ของหวาน</option>
                      <option value="drink">เครื่องดื่ม</option>
                      <option value="salad">สลัด</option>
                      <option value="soup">ซุป</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-3">
                    <Plus className="w-4 h-4 inline mr-2" />
                    ส่วนผสม
                  </label>
                  <textarea
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 bg-slate-50 hover:bg-white"
                    rows="2"
                    placeholder="ระบุส่วนผสมหลัก (แยกด้วยเครื่องหมายจุลภาค)"
                    value={menuData.ingredients}
                    onChange={(e) =>
                      setMenuData({ ...menuData, ingredients: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-3">
                    <Image className="w-4 h-4 inline mr-2" />
                    รูปภาพเมนู
                  </label>
                  <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 hover:border-emerald-400 transition-colors duration-200">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="w-full"
                    />
                    {imagePreview && (
                      <div className="mt-4">
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="max-w-full h-40 object-cover rounded-xl shadow-md"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isAvailable"
                    checked={menuData.isAvailable}
                    onChange={(e) =>
                      setMenuData({
                        ...menuData,
                        isAvailable: e.target.checked,
                      })
                    }
                    className="mr-3 w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                  />
                  <label
                    htmlFor="isAvailable"
                    className="text-sm font-medium text-slate-700"
                  >
                    เมนูพร้อมขาย
                  </label>
                </div>

                <div className="flex gap-4 pt-6 border-t border-slate-200">
                  <button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white py-3 px-6 rounded-xl transition-all duration-200 hover:shadow-lg hover:scale-105 flex items-center justify-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    อัพโหลดเมนู
                  </button>
                  <button
                    type="button"
                    onClick={resetMenuForm}
                    className="px-8 py-3 border border-slate-300 rounded-xl hover:bg-slate-50 transition-all duration-200"
                  >
                    ยกเลิก
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Enhanced Users Table */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden backdrop-blur-sm">
          <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100">
            <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <Users className="w-5 h-5" />
              รายการผู้ใช้งาน ({filteredUsers.length})
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">
                    ผู้ใช้งาน
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">
                    Role
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">
                    สถานะ
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">
                    สร้างเมื่อ
                  </th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-slate-700">
                    จัดการ
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredUsers.map((user, index) => (
                  <tr
                    key={user.id}
                    className="hover:bg-slate-50 transition-colors duration-200 group"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                          {user.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">
                            {user.username}
                          </div>
                          <div className="text-sm text-slate-500">
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {getRoleIcon(user.role)}
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${getRoleColor(
                            user.role
                          )}`}
                        >
                          {user.role}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                          user.status === "active"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            : "bg-slate-100 text-slate-800 border border-slate-200"
                        }`}
                      >
                        <div
                          className={`w-2 h-2 rounded-full mr-2 ${
                            user.status === "active"
                              ? "bg-emerald-500"
                              : "bg-slate-400"
                          }`}
                        ></div>
                        {user.status === "active" ? "ใช้งานอยู่" : "ไม่ใช้งาน"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {user.createdAt}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <button
                          className="p-2 rounded-lg hover:bg-blue-100 text-blue-600 transition-all duration-200 hover:scale-110"
                          onClick={() => toggleUserStatus(user.id)}
                          title="เปลี่ยนสถานะ"
                        >
                          {user.status === "active" ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => startEdit(user)}
                          title="แก้ไข"
                          className="p-2 rounded-lg hover:bg-orange-100 text-orange-600 transition-all duration-200 hover:scale-110"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => handledeleteSubmit(user.username)}
                          title="ลบ"
                          className="p-2 rounded-lg hover:bg-red-100 text-red-600 transition-all duration-200 hover:scale-110"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan="5" className="text-center py-12">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                          <Users className="w-8 h-8 text-slate-400" />
                        </div>
                        <div className="text-slate-500 font-medium">
                          ไม่พบผู้ใช้งาน
                        </div>
                        <div className="text-sm text-slate-400">
                          ลองเปลี่ยนเงื่อนไขการค้นหาหรือเพิ่มผู้ใช้ใหม่
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, color = "slate", icon, trend }) => {
  const colorClasses = {
    slate:
      "from-slate-600 to-slate-700 bg-slate-50 border-slate-200 text-slate-700",
    emerald:
      "from-emerald-600 to-emerald-700 bg-emerald-50 border-emerald-200 text-emerald-700",
    red: "from-red-600 to-red-700 bg-red-50 border-red-200 text-red-700",
    orange:
      "from-orange-600 to-orange-700 bg-orange-50 border-orange-200 text-orange-700",
    blue: "from-blue-600 to-blue-700 bg-blue-50 border-blue-200 text-blue-700",
  };

  return (
    <div
      className={`bg-white border rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 backdrop-blur-sm ${colorClasses[
        color
      ]
        .split(" ")
        .slice(2)
        .join(" ")}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div
          className={`p-2 rounded-xl bg-gradient-to-r ${colorClasses[color]
            .split(" ")
            .slice(0, 2)
            .join(" ")} text-white`}
        >
          {icon}
        </div>
        {trend && (
          <div className="flex items-center gap-1 text-xs font-medium text-emerald-600">
            <TrendingUp className="w-3 h-3" />
            {trend}
          </div>
        )}
      </div>
      <div className="space-y-1">
        <div
          className={`text-3xl font-bold ${colorClasses[color].split(" ")[4]}`}
        >
          {value ?? 0}
        </div>
        <div className="text-sm text-slate-500 font-medium">{label}</div>
      </div>
    </div>
  );
};

export default AdminUserManagement;
