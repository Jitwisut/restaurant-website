"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
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
  Loader2,
  AlertCircle,
  CheckCircle,
  Menu,
  ChevronDown,
  MoreVertical,
  RefreshCw,
} from "lucide-react";
import axios from "axios";

// Loading Spinner Component
const LoadingSpinner = ({ size = "md", className = "" }) => {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
  };

  return (
    <Loader2 className={`${sizeClasses[size]} animate-spin ${className}`} />
  );
};

// Form Input with Error Handling
const FormInput = ({
  label,
  error,
  required = false,
  icon: Icon,
  loading = false,
  ...props
}) => (
  <div className="space-y-2">
    <label className="flex items-center text-sm font-medium text-slate-700 gap-2">
      {Icon && <Icon className="w-4 h-4" />}
      {label}
      {required && <span className="text-red-500">*</span>}
    </label>
    <div className="relative">
      <input
        {...props}
        disabled={loading || props.disabled}
        className={`w-full border p-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-slate-50 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed ${
          error ? "border-red-300 bg-red-50" : "border-slate-200"
        } ${props.className || ""}`}
        aria-invalid={error ? "true" : "false"}
        aria-describedby={error ? `${props.id}-error` : undefined}
      />
      {loading && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          <LoadingSpinner size="sm" />
        </div>
      )}
    </div>
    {error && (
      <p
        id={`${props.id}-error`}
        className="text-sm text-red-600 flex items-center gap-1"
      >
        <AlertCircle className="w-4 h-4" />
        {error}
      </p>
    )}
  </div>
);

// Enhanced Confirmation Modal
const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "ยืนยัน",
  cancelText = "ยกเลิก",
  type = "danger",
  loading = false,
}) => {
  if (!isOpen) return null;

  const typeStyles = {
    danger: "from-red-600 to-red-700",
    warning: "from-yellow-600 to-yellow-700",
    success: "from-green-600 to-green-700",
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200">
        <div className="p-6 space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <p className="text-slate-600">{message}</p>
          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className={`flex-1 bg-gradient-to-r ${typeStyles[type]} text-white px-4 py-2 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2`}
            >
              {loading && <LoadingSpinner size="sm" />}
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Debounced Search Hook
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// Enhanced StatCard with Loading State
const StatCard = ({
  label,
  value,
  color = "slate",
  icon,
  trend,
  loading = false,
}) => {
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
      className={`bg-white border rounded-2xl p-4 lg:p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 backdrop-blur-sm ${colorClasses[
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
          className={`text-2xl lg:text-3xl font-bold ${
            colorClasses[color].split(" ")[4]
          }`}
        >
          {loading ? <LoadingSpinner size="sm" /> : value ?? 0}
        </div>
        <div className="text-xs lg:text-sm text-slate-500 font-medium">
          {label}
        </div>
      </div>
    </div>
  );
};

const AdminUserManagement = () => {
  const router = useRouter();
  const modalRef = useRef(null);

  // Data States
  const [users, setUsers] = useState([]);
  const [role, setRole] = useState({});
  const [total, setTotal] = useState(0);

  // UI States
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showMenuUpload, setShowMenuUpload] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Loading States
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);

  // Form States
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userRole, setUserRole] = useState("user");
  const [originuser, setOriginuser] = useState("");
  const [errors, setErrors] = useState({});

  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  // Debounced search
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  // Menu Upload States
  const [menuData, setMenuData] = useState({
    name: "",
    description: "",
    price: "",
    image: "",
    category: "",
    ingredients: "",
    isAvailable: true,
  });
  const [imagePreview, setImagePreview] = useState(null);

  // Confirmation Modal States
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
    type: "danger",
  });

  const baseurl = process.env.NEXT_PUBLIC_BACKEND_URL;

  // Form Validation
  const validateForm = useCallback(() => {
    const newErrors = {};

    if (!username.trim()) {
      newErrors.username = "กรุณากรอก Username";
    } else if (username.length < 3) {
      newErrors.username = "Username ต้องมีอย่างน้อย 3 ตัวอักษร";
    }

    if (!email.trim()) {
      newErrors.email = "กรุณากรอก Email";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "รูปแบบ Email ไม่ถูกต้อง";
    }

    if (!editingUser && !password.trim()) {
      newErrors.password = "กรุณากรอก Password";
    } else if (!editingUser && password.length < 6) {
      newErrors.password = "Password ต้องมีอย่างน้อย 6 ตัวอักษร";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [username, email, password, editingUser]);

  // Auth Check
  useEffect(() => {
    const admin = async () => {
      const token = sessionStorage.getItem("auth");
      if (!token) {
        router.replace("/");
        return;
      }
      try {
        const res = await axios.get(`${baseurl}/middleware/admin`, {
          headers: { Authorization: `Bearer ${token}` },
          withCredentials: true,
        });
        if (res.status === 200) {
          setIsAuthorized(true);
          await fetchUser();
        }
      } catch (error) {
        if (error.response?.status === 401) {
          console.log("ยังไม่ได้ login");
          router.replace("/");
        } else if (error.response?.status === 403) {
          console.log("ไม่ใช่ admin");
          router.replace("/");
        } else {
          console.log("เกิดข้อผิดพลาดอื่น:", error);
        }
      } finally {
        setIsAuthChecking(false);
      }
    };

    admin();
  }, [router]);

  // Fetch Users Data
  const fetchUser = async () => {
    try {
      setLoading(true);
      setStatsLoading(true);

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
      Swal.fire({
        icon: "error",
        title: "เกิดข้อผิดพลาด",
        text: "ไม่สามารถดึงข้อมูลผู้ใช้ได้",
      });
    } finally {
      setLoading(false);
      setStatsLoading(false);
    }
  };

  // Form Submission with Loading
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setSubmitLoading(true);
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
          timer: 2000,
          showConfirmButton: false,
        });

        await fetchUser();
        resetForm();
      }
    } catch (error) {
      console.error(error);
      Swal.fire({
        icon: "error",
        title: "เกิดข้อผิดพลาด",
        text: error.response?.data?.message || "ไม่สามารถสร้างผู้ใช้ได้",
      });
    } finally {
      setSubmitLoading(false);
    }
  };

  // Reset Form
  const resetForm = () => {
    setUsername("");
    setEmail("");
    setPassword("");
    setUserRole("user");
    setErrors({});
    setShowCreateForm(false);
  };

  // Update User
  const updateUser = async () => {
    if (!validateForm()) return;

    setSubmitLoading(true);
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
          timer: 2000,
          showConfirmButton: false,
        });

        await fetchUser();
        cancelEdit();
      }
    } catch (error) {
      console.error("Update error:", error);
      Swal.fire({
        icon: "error",
        title: "เกิดข้อผิดพลาด",
        text: "ไม่สามารถแก้ไขข้อมูลได้",
      });
    } finally {
      setSubmitLoading(false);
    }
  };

  // Delete User with Confirmation
  const handleDeleteUser = (username) => {
    setConfirmModal({
      isOpen: true,
      title: "ยืนยันการลบผู้ใช้",
      message: `คุณแน่ใจหรือไม่ที่จะลบผู้ใช้ "${username}" ออกจากระบบ?`,
      onConfirm: () => performDeleteUser(username),
      type: "danger",
    });
  };

  const performDeleteUser = async (username) => {
    try {
      const res = await axios.post(`${baseurl}/admin/deleteuser`, {
        username: username,
      });

      if (res.status === 201) {
        Swal.fire({
          icon: "success",
          title: "ลบข้อมูลผู้ใช้เรียบร้อย",
          text: "ผู้ใช้ถูกลบออกจากระบบแล้ว",
          timer: 2000,
          showConfirmButton: false,
        });
        await fetchUser();
      }
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "เกิดข้อผิดพลาด",
        text: "ไม่สามารถลบผู้ใช้ได้",
      });
    } finally {
      setConfirmModal({ ...confirmModal, isOpen: false });
    }
  };

  // Edit User
  const startEdit = (user) => {
    setEditingUser(user);
    setUsername(user.username);
    setEmail(user.email);
    setUserRole(user.role);
    setOriginuser(user.username);
    setErrors({});
  };

  const cancelEdit = () => {
    setEditingUser(null);
    resetForm();
  };

  // Toggle User Status
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
      if (file.size > 5 * 1024 * 1024) {
        // 5MB limit
        Swal.fire({
          icon: "error",
          title: "ไฟล์ใหญ่เกินไป",
          text: "กรุณาเลือกไฟล์ที่มีขนาดไม่เกิน 5MB",
        });
        return;
      }

      setMenuData({ ...menuData, image: file });
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Menu Form Submission
  const handleMenuSubmit = async (e) => {
    e.preventDefault();
    setSubmitLoading(true);

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
          timer: 2000,
          showConfirmButton: false,
        });
        resetMenuForm();
      }
    } catch (error) {
      console.error("Upload error:", error);
      Swal.fire({
        icon: "error",
        title: "เกิดข้อผิดพลาด",
        text: "ไม่สามารถอัพโหลดเมนูได้ กรุณาลองใหม่อีกครั้ง",
      });
    } finally {
      setSubmitLoading(false);
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

  // Auto-close modal on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        if (showMenuUpload && !submitLoading) {
          resetMenuForm();
        }
      }
    };

    if (showMenuUpload) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showMenuUpload, submitLoading]);

  // Filter Users
  const filteredUsers = users.filter((user) => {
    const matchSearch =
      user.username.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(debouncedSearchTerm.toLowerCase());
    const matchRole = filterRole === "all" || user.role === filterRole;
    const matchStatus = filterStatus === "all" || user.status === filterStatus;
    return matchSearch && matchRole && matchStatus;
  });

  // Helper Functions
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

  // แสดง Loading Screen ขณะตรวจสอบสิทธิ์
  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <LoadingSpinner size="lg" className="mx-auto text-blue-600" />
          <p className="text-slate-600 font-medium">
            กำลังตรวจสอบสิทธิ์การเข้าถึง...
          </p>
        </div>
      </div>
    );
  }
  // ถ้าไม่มีสิทธิ์ ไม่แสดงอะไรเลย (จะถูก redirect อยู่แล้ว)
  if (!isAuthorized) {
    return null;
  }
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto p-4 lg:p-6">
        {/* Enhanced Header Section */}
        <div className="mb-6 lg:mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl lg:text-4xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                จัดการผู้ใช้งาน
              </h1>
              <p className="text-slate-600 mt-2 text-sm lg:text-base">
                ระบบบริหารจัดการผู้ใช้งานและเมนูอาหาร
              </p>
            </div>
            <div className="flex items-center gap-2 lg:gap-3">
              <button
                onClick={fetchUser}
                disabled={loading}
                className="p-2 rounded-xl bg-white shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 disabled:opacity-50"
                aria-label="รีเฟรชข้อมูล"
              >
                <RefreshCw
                  className={`w-5 h-5 text-slate-600 ${
                    loading ? "animate-spin" : ""
                  }`}
                />
              </button>
              <button className="p-2 rounded-xl bg-white shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105">
                <Settings className="w-5 h-5 text-slate-600" />
              </button>
              <button className="p-2 rounded-xl bg-white shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105">
                <Download className="w-5 h-5 text-slate-600" />
              </button>
              {/* Mobile Menu Toggle */}
              <button
                className="lg:hidden p-2 rounded-xl bg-white shadow-md"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="เมนู"
              >
                <Menu className="w-5 h-5 text-slate-600" />
              </button>
            </div>
          </div>
        </div>

        {/* Enhanced Statistics Cards - Responsive Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 lg:gap-4 mb-6 lg:mb-8">
          <StatCard
            label="ทั้งหมด"
            value={total}
            icon={<Users className="w-4 lg:w-6 h-4 lg:h-6" />}
            color="slate"
            trend="+12%"
            loading={statsLoading}
          />
          <StatCard
            label="ใช้งานอยู่"
            value={stats.active}
            icon={<Activity className="w-4 lg:w-6 h-4 lg:h-6" />}
            color="emerald"
            trend="+8%"
            loading={statsLoading}
          />
          <StatCard
            label="ไม่ใช้งาน"
            value={stats.inactive}
            icon={<EyeOff className="w-4 lg:w-6 h-4 lg:h-6" />}
            color="slate"
            trend="-2%"
            loading={statsLoading}
          />
          <StatCard
            label="Admin"
            value={role.admin}
            icon={<Shield className="w-4 lg:w-6 h-4 lg:h-6" />}
            color="red"
            loading={statsLoading}
          />
          <StatCard
            label="Kitchen"
            value={role.kitchen}
            icon={<ChefHat className="w-4 lg:w-6 h-4 lg:h-6" />}
            color="orange"
            loading={statsLoading}
          />
          <StatCard
            label="User"
            value={role.user}
            icon={<Users className="w-4 lg:w-6 h-4 lg:h-6" />}
            color="blue"
            loading={statsLoading}
          />
        </div>

        {/* Enhanced Search & Filter Bar - Mobile Optimized */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-4 lg:p-6 mb-6 backdrop-blur-sm">
          <div className="flex flex-col gap-4">
            {/* Search Input - Always Visible */}
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-slate-50 hover:bg-white"
                placeholder="ค้นหา username หรือ email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                aria-label="ค้นหาผู้ใช้"
              />
            </div>

            {/* Filters and Actions - Responsive Layout */}
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Filters */}
              <div className="flex gap-3 flex-1">
                <div className="relative flex-1 sm:flex-none">
                  <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <select
                    value={filterRole}
                    onChange={(e) => setFilterRole(e.target.value)}
                    className="w-full pl-10 pr-8 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 bg-slate-50 hover:bg-white transition-all duration-200 appearance-none"
                    aria-label="กรองตาม Role"
                  >
                    <option value="all">ทุก Role</option>
                    <option value="admin">Admin</option>
                    <option value="kitchen">Kitchen</option>
                    <option value="user">User</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                </div>

                <div className="relative flex-1 sm:flex-none">
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 bg-slate-50 hover:bg-white transition-all duration-200 appearance-none"
                    aria-label="กรองตามสถานะ"
                  >
                    <option value="all">ทุกสถานะ</option>
                    <option value="active">ใช้งานอยู่</option>
                    <option value="inactive">ไม่ใช้งาน</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCreateForm(true)}
                  disabled={loading}
                  className="flex-1 sm:flex-none bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-4 lg:px-6 py-3 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 hover:shadow-lg hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="เพิ่มผู้ใช้ใหม่"
                >
                  {loading ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <UserPlus className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline">เพิ่มผู้ใช้</span>
                  <span className="sm:hidden">เพิ่ม</span>
                </button>
                <button
                  onClick={() => setShowMenuUpload(true)}
                  disabled={loading}
                  className="flex-1 sm:flex-none bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white px-4 lg:px-6 py-3 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 hover:shadow-lg hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="อัพโหลดเมนูอาหาร"
                >
                  {loading ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline">อัพโหลดเมนู</span>
                  <span className="sm:hidden">เมนู</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced User Form with Better Validation */}
        {(showCreateForm || editingUser) && (
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 lg:p-8 mb-6 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-100 rounded-xl">
                <UserPlus className="w-6 h-6 text-blue-600" />
              </div>
              <h2 className="text-xl lg:text-2xl font-bold text-slate-800">
                {editingUser ? "แก้ไขข้อมูลผู้ใช้" : "เพิ่มผู้ใช้ใหม่"}
              </h2>
            </div>

            <form
              onSubmit={editingUser ? updateUser : handleSubmit}
              className="grid md:grid-cols-2 gap-6"
            >
              <FormInput
                id="username"
                label="Username"
                type="text"
                placeholder="กรอก Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                error={errors.username}
                required
                loading={submitLoading}
                icon={Users}
              />

              <FormInput
                id="email"
                label="Email"
                type="email"
                placeholder="กรอก Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={errors.email}
                required
                loading={submitLoading}
              />

              {!editingUser && (
                <FormInput
                  id="password"
                  label="Password"
                  type="password"
                  placeholder="กรอก Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  error={errors.password}
                  required
                  loading={submitLoading}
                />
              )}

              <div className="space-y-2">
                <label className="flex items-center text-sm font-medium text-slate-700 gap-2">
                  <Shield className="w-4 h-4" />
                  Role <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={userRole}
                    onChange={(e) => setUserRole(e.target.value)}
                    disabled={submitLoading}
                    className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-slate-50 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed appearance-none"
                    aria-label="เลือก Role"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                    <option value="kitchen">Kitchen</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                </div>
              </div>
            </form>

            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <button
                onClick={editingUser ? updateUser : handleSubmit}
                disabled={submitLoading}
                className="flex-1 sm:flex-none bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-8 py-3 rounded-xl transition-all duration-200 hover:shadow-lg hover:scale-105 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitLoading && <LoadingSpinner size="sm" />}
                {editingUser ? "บันทึกการแก้ไข" : "สร้างผู้ใช้"}
              </button>
              <button
                onClick={editingUser ? cancelEdit : resetForm}
                disabled={submitLoading}
                className="flex-1 sm:flex-none bg-slate-500 hover:bg-slate-600 text-white px-8 py-3 rounded-xl transition-all duration-200 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        )}

        {/* Enhanced Menu Upload Modal with Better UX */}
        {showMenuUpload && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div
              ref={modalRef}
              className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200"
            >
              <div className="flex justify-between items-center p-6 border-b border-slate-200 sticky top-0 bg-white rounded-t-2xl">
                <h2 className="text-xl lg:text-2xl font-bold flex items-center gap-3 text-slate-800">
                  <div className="p-2 bg-emerald-100 rounded-xl">
                    <Upload className="w-6 h-6 text-emerald-600" />
                  </div>
                  อัพโหลดเมนูอาหาร
                </h2>
                <button
                  onClick={resetMenuForm}
                  disabled={submitLoading}
                  className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-xl transition-all duration-200 disabled:opacity-50"
                  aria-label="ปิด"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleMenuSubmit} className="p-6 space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-3">
                      <FileText className="w-4 h-4 inline mr-2" />
                      ชื่อเมนู <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      disabled={submitLoading}
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 bg-slate-50 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="กรอกชื่อเมนูอาหาร"
                      value={menuData.name}
                      onChange={(e) =>
                        setMenuData({ ...menuData, name: e.target.value })
                      }
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-3">
                      <FileText className="w-4 h-4 inline mr-2" />
                      รายละเอียด
                    </label>
                    <textarea
                      disabled={submitLoading}
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 bg-slate-50 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                      rows="3"
                      placeholder="รายละเอียดของเมนูอาหาร"
                      value={menuData.description}
                      onChange={(e) =>
                        setMenuData({
                          ...menuData,
                          description: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-3">
                      <DollarSign className="w-4 h-4 inline mr-2" />
                      ราคา (บาท) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      disabled={submitLoading}
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 bg-slate-50 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
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
                      หมวดหมู่ <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        required
                        disabled={submitLoading}
                        className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 bg-slate-50 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed appearance-none"
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
                      <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-3">
                      <Plus className="w-4 h-4 inline mr-2" />
                      ส่วนผสม
                    </label>
                    <textarea
                      disabled={submitLoading}
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 bg-slate-50 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                      rows="2"
                      placeholder="ระบุส่วนผสมหลัก (แยกด้วยเครื่องหมายจุลภาค)"
                      value={menuData.ingredients}
                      onChange={(e) =>
                        setMenuData({
                          ...menuData,
                          ingredients: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-3">
                    <Image className="w-4 h-4 inline mr-2" />
                    รูปภาพเมนู
                  </label>
                  <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 hover:border-emerald-400 transition-colors duration-200 text-center">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      disabled={submitLoading}
                      className="w-full disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <p className="text-sm text-slate-500 mt-2">
                      รองรับไฟล์: JPG, PNG, GIF (ขนาดไม่เกิน 5MB)
                    </p>
                    {imagePreview && (
                      <div className="mt-4">
                        <img
                          src={imagePreview}
                          alt="ตัวอย่างรูปภาพ"
                          className="max-w-full h-40 object-cover rounded-xl shadow-md mx-auto"
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
                    disabled={submitLoading}
                    className="mr-3 w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <label
                    htmlFor="isAvailable"
                    className="text-sm font-medium text-slate-700 cursor-pointer"
                  >
                    เมนูพร้อมขาย
                  </label>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-slate-200">
                  <button
                    type="submit"
                    disabled={submitLoading}
                    className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white py-3 px-6 rounded-xl transition-all duration-200 hover:shadow-lg hover:scale-105 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitLoading ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    อัพโหลดเมนู
                  </button>
                  <button
                    type="button"
                    onClick={resetMenuForm}
                    disabled={submitLoading}
                    className="flex-1 sm:flex-none px-8 py-3 border border-slate-300 rounded-xl hover:bg-slate-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ยกเลิก
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Enhanced Users Table with Better Mobile Experience */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden backdrop-blur-sm">
          <div className="px-4 lg:px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <Users className="w-5 h-5" />
                รายการผู้ใช้งาน ({filteredUsers.length})
              </h3>
              {loading && <LoadingSpinner size="sm" />}
            </div>
          </div>

          {/* Loading State */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <LoadingSpinner size="lg" className="mx-auto mb-4" />
                <p className="text-slate-500">กำลังโหลดข้อมูล...</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 lg:px-6 py-4 text-left text-sm font-semibold text-slate-700">
                      ผู้ใช้งาน
                    </th>
                    <th className="px-4 lg:px-6 py-4 text-left text-sm font-semibold text-slate-700">
                      Role
                    </th>
                    <th className="px-4 lg:px-6 py-4 text-left text-sm font-semibold text-slate-700">
                      สถานะ
                    </th>
                    <th className="px-4 lg:px-6 py-4 text-left text-sm font-semibold text-slate-700 hidden lg:table-cell">
                      สร้างเมื่อ
                    </th>
                    <th className="px-4 lg:px-6 py-4 text-right text-sm font-semibold text-slate-700">
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
                      <td className="px-4 lg:px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 lg:w-10 lg:h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-xs lg:text-sm">
                            {user.username.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-slate-900 truncate">
                              {user.username}
                            </div>
                            <div className="text-xs lg:text-sm text-slate-500 truncate">
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 lg:px-6 py-4">
                        <div className="flex items-center gap-2">
                          {getRoleIcon(user.role)}
                          <span
                            className={`px-2 lg:px-3 py-1 rounded-full text-xs font-semibold ${getRoleColor(
                              user.role
                            )}`}
                          >
                            {user.role}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 lg:px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2 lg:px-3 py-1 rounded-full text-xs font-semibold ${
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
                          {user.status === "active"
                            ? "ใช้งานอยู่"
                            : "ไม่ใช้งาน"}
                        </span>
                      </td>
                      <td className="px-4 lg:px-6 py-4 text-sm text-slate-600 hidden lg:table-cell">
                        {user.createdAt}
                      </td>
                      <td className="px-4 lg:px-6 py-4">
                        <div className="flex gap-1 lg:gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <button
                            className="p-2 rounded-lg hover:bg-blue-100 text-blue-600 transition-all duration-200 hover:scale-110 touch-target"
                            onClick={() => toggleUserStatus(user.id)}
                            title="เปลี่ยนสถานะ"
                            aria-label={`เปลี่ยนสถานะผู้ใช้ ${user.username}`}
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
                            className="p-2 rounded-lg hover:bg-orange-100 text-orange-600 transition-all duration-200 hover:scale-110 touch-target"
                            aria-label={`แก้ไขผู้ใช้ ${user.username}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.username)}
                            title="ลบ"
                            className="p-2 rounded-lg hover:bg-red-100 text-red-600 transition-all duration-200 hover:scale-110 touch-target"
                            aria-label={`ลบผู้ใช้ ${user.username}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && !loading && (
                    <tr>
                      <td colSpan="5" className="text-center py-12">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                            <Users className="w-8 h-8 text-slate-400" />
                          </div>
                          <div className="text-slate-500 font-medium">
                            ไม่พบผู้ใช้งาน
                          </div>
                          <div className="text-sm text-slate-400 max-w-md text-center">
                            {debouncedSearchTerm ||
                            filterRole !== "all" ||
                            filterStatus !== "all"
                              ? "ลองเปลี่ยนเงื่อนไขการค้นหาหรือกรองข้อมูล"
                              : "ยังไม่มีผู้ใช้ในระบบ เริ่มต้นด้วยการเพิ่มผู้ใช้ใหม่"}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Confirmation Modal */}
        <ConfirmationModal
          isOpen={confirmModal.isOpen}
          onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
          onConfirm={confirmModal.onConfirm}
          title={confirmModal.title}
          message={confirmModal.message}
          type={confirmModal.type}
          loading={submitLoading}
        />
      </div>
    </div>
  );
};

export default AdminUserManagement;
