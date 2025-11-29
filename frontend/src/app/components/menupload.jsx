"use client";
import React from "react";
import {
    Upload,
    X,
    FileText,
    DollarSign,
    Tag,
    Plus,
    Image,
    ChevronDown,
} from "lucide-react";

/**
 * MenuUploadModal Component
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - Controls modal visibility
 * @param {Function} props.onClose - Callback when modal closes
 * @param {Object} props.menuData - Menu form data object
 * @param {Function} props.setMenuData - Function to update menu data
 * @param {Function} props.handleSubmit - Form submission handler
 * @param {Function} props.handleImageChange - Image upload handler
 * @param {string} props.imagePreview - Image preview URL
 * @param {boolean} props.submitLoading - Loading state for form submission
 * @param {React.Ref} props.modalRef - Ref for modal element
 * @param {React.Component} props.LoadingSpinner - Loading spinner component
 */
export default function MenuUploadModal({
    isOpen,
    onClose,
    menuData,
    setMenuData,
    handleSubmit,
    handleImageChange,
    imagePreview,
    submitLoading = false,
    modalRef,
    LoadingSpinner,
}) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div
                ref={modalRef}
                className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200"
            >
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-slate-200 sticky top-0 bg-white rounded-t-2xl">
                    <h2 className="text-xl lg:text-2xl font-bold flex items-center gap-3 text-slate-800">
                        <div className="p-2 bg-emerald-100 rounded-xl">
                            <Upload className="w-6 h-6 text-emerald-600" />
                        </div>
                        อัพโหลดเมนูอาหาร
                    </h2>
                    <button
                        onClick={onClose}
                        disabled={submitLoading}
                        className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-xl transition-all duration-200 disabled:opacity-50"
                        aria-label="ปิด"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Menu Name */}
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
                                value={menuData.name || ""}
                                onChange={(e) =>
                                    setMenuData({ ...menuData, name: e.target.value })
                                }
                            />
                        </div>

                        {/* Description */}
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
                                value={menuData.description || ""}
                                onChange={(e) =>
                                    setMenuData({
                                        ...menuData,
                                        description: e.target.value,
                                    })
                                }
                            />
                        </div>

                        {/* Price */}
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
                                value={menuData.price || ""}
                                onChange={(e) =>
                                    setMenuData({ ...menuData, price: e.target.value })
                                }
                            />
                        </div>

                        {/* Category */}
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
                                    value={menuData.category || ""}
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

                        {/* Ingredients */}
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
                                value={menuData.ingredients || ""}
                                onChange={(e) =>
                                    setMenuData({
                                        ...menuData,
                                        ingredients: e.target.value,
                                    })
                                }
                            />
                        </div>
                    </div>

                    {/* Image Upload */}
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

                    {/* Availability Checkbox */}
                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            id="isAvailable"
                            checked={menuData.isAvailable || false}
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

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-slate-200">
                        <button
                            type="submit"
                            disabled={submitLoading}
                            className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white py-3 px-6 rounded-xl transition-all duration-200 hover:shadow-lg hover:scale-105 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {submitLoading && LoadingSpinner ? (
                                <LoadingSpinner size="sm" />
                            ) : (
                                <Upload className="w-4 h-4" />
                            )}
                            อัพโหลดเมนู
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitLoading}
                            className="flex-1 sm:flex-none px-8 py-3 border border-slate-300 rounded-xl hover:bg-slate-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            ยกเลิก
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}