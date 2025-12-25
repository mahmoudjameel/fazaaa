import React, { useEffect, useState } from 'react';
import {
  Search, CheckCircle, XCircle, Clock, Eye, Phone, Mail, Star, Power,
  UserCheck, Users, Plus, Edit2, Trash2, Tag, X
} from 'lucide-react';
import {
  getAllProviders,
  updateProviderStatus,
  getAllProviderGroups,
  createProviderGroup,
  updateProviderGroup,
  deleteProviderGroup,
  assignProvidersToGroup,
  removeProviderFromGroup,
  updateProviderServiceStatus,
  createManualProvider,
} from '../services/adminService';
import { doc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../services/firebase';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

export const NATIONALITIES = [
  { value: 'sa', label: 'السعودية' },
  { value: 'ae', label: 'الإمارات' },
  { value: 'kw', label: 'الكويت' },
  { value: 'bh', label: 'البحرين' },
  { value: 'om', label: 'عُمان' },
  { value: 'qa', label: 'قطر' },
  { value: 'jo', label: 'الأردن' },
  { value: 'eg', label: 'مصر' },
  { value: 'ye', label: 'اليمن' },
  { value: 'ma', label: 'المغرب' },
  { value: 'dz', label: 'الجزائر' },
  { value: 'tn', label: 'تونس' },
  { value: 'lb', label: 'لبنان' },
  { value: 'sy', label: 'سوريا' },
  { value: 'sd', label: 'السودان' },
  { value: 'other', label: 'جنسية أخرى' },
];

export const Providers = () => {
  const [providers, setProviders] = useState([]);
  const [filteredProviders, setFilteredProviders] = useState([]);
  const [groups, setGroups] = useState([]);
  const [mainServices, setMainServices] = useState([]); // الخدمات الرئيسية من emergency-services
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [selectedProvidersForGroup, setSelectedProvidersForGroup] = useState([]);

  // Groups Management
  const [showGroupsSection, setShowGroupsSection] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isAssignGroupModalOpen, setIsAssignGroupModalOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupFormData, setGroupFormData] = useState({
    name: '',
    description: '',
    color: '#6366F1',
    icon: 'users',
    isVip: false,
    priority: 0,
  });
  const [isAddProviderModalOpen, setIsAddProviderModalOpen] = useState(false);
  const [providerFormData, setProviderFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    nationality: '',
    services: [],
  });
  const [idImageFile, setIdImageFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    fetchProviders();
    fetchGroups();
    fetchMainServices();
  }, []);

  // جلب الخدمات الرئيسية من emergency-services
  const fetchMainServices = async () => {
    try {
      const servicesRef = collection(db, 'emergency-services');
      const querySnapshot = await getDocs(servicesRef);
      const services = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.isActive !== false) {
          services.push({
            id: doc.id, // Firebase document ID
            serviceId: data.id || doc.id, // Service ID
            name: data.name || '',
          });
        }
      });
      setMainServices(services);
    } catch (error) {
      console.error('Error fetching main services:', error);
    }
  };

  useEffect(() => {
    filterProviders();
  }, [providers, searchTerm, statusFilter, typeFilter, groupFilter]);

  const fetchProviders = async () => {
    try {
      const result = await getAllProviders();
      setProviders(result.providers);
    } catch (error) {
      console.error('Error fetching providers:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const result = await getAllProviderGroups();
      setGroups(result.groups);
    } catch (error) {
      console.error('Error fetching groups:', error);
    }
  };

  const filterProviders = () => {
    let filtered = providers;

    if (statusFilter !== 'all') {
      // استخدام approvalStatus بدلاً من status (status قد يكون "online"/"offline")
      filtered = filtered.filter((p) => {
        const approvalStatus = p.approvalStatus || p.status;
        // إذا كانت statusFilter هي pending/approved/rejected، استخدم approvalStatus
        // إذا كانت statusFilter هي online/offline، استخدم status
        if (['pending', 'approved', 'rejected'].includes(statusFilter)) {
          return approvalStatus === statusFilter;
        }
        return p.status === statusFilter;
      });
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter((p) => p.type === typeFilter);
    }

    if (groupFilter !== 'all') {
      if (groupFilter === 'no-group') {
        filtered = filtered.filter((p) => !p.groupId);
      } else {
        filtered = filtered.filter((p) => p.groupId === groupFilter);
      }
    }

    if (searchTerm) {
      filtered = filtered.filter(
        (p) =>
          p.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.phone?.includes(searchTerm)
      );
    }

    setFilteredProviders(filtered);
  };

  const handleStatusChange = async (providerId, newStatus) => {
    try {
      await updateProviderStatus(providerId, newStatus);
      setProviders((prev) =>
        prev.map((p) => (p.id === providerId ? { ...p, approvalStatus: newStatus } : p))
      );
      setSelectedProvider(null);
      alert(`تم ${newStatus === 'approved' ? 'قبول' : newStatus === 'rejected' ? 'رفض' : 'إعادة'} المزود بنجاح`);
    } catch (error) {
      console.error('Error updating provider status:', error);
      alert('فشل تحديث حالة المزود');
    }
  };

  const toggleProviderType = async (providerId) => {
    try {
      const provider = providers.find(p => p.id === providerId);
      const newType = provider.type === 'vip' ? 'general' : 'vip';
      const providerRef = doc(db, 'providers', providerId);
      await updateDoc(providerRef, {
        type: newType,
        updatedAt: new Date().toISOString()
      });
      setProviders(providers.map(p => p.id === providerId ? { ...p, type: newType, updatedAt: new Date().toISOString() } : p));
    } catch (error) {
      console.error('Error updating provider type:', error);
      alert('فشل تحديث نوع المزود');
    }
  };

  const toggleProviderActivation = async (providerId) => {
    try {
      const provider = providers.find(p => p.id === providerId);
      const newStatus = provider.isActive === false ? true : false;
      const providerRef = doc(db, 'providers', providerId);
      await updateDoc(providerRef, {
        isActive: newStatus,
        updatedAt: new Date().toISOString()
      });
      setProviders(providers.map(p => p.id === providerId ? { ...p, isActive: newStatus, updatedAt: new Date().toISOString() } : p));
    } catch (error) {
      console.error('Error updating provider activation:', error);
      alert('فشل تحديث تفعيل المزود');
    }
  };

  // Groups Management Functions
  const handleCreateGroup = async () => {
    try {
      if (!groupFormData.name.trim()) {
        alert('يرجى إدخال اسم المجموعة');
        return;
      }
      await createProviderGroup(groupFormData);
      await fetchGroups();
      setIsGroupModalOpen(false);
      setGroupFormData({
        name: '',
        description: '',
        color: '#6366F1',
        icon: 'users',
        isVip: false,
        priority: 0,
      });
      alert('تم إنشاء المجموعة بنجاح');
    } catch (error) {
      console.error('Error creating group:', error);
      alert('فشل إنشاء المجموعة');
    }
  };

  const handleUpdateGroup = async () => {
    try {
      if (!selectedGroup || !groupFormData.name.trim()) {
        alert('يرجى إدخال اسم المجموعة');
        return;
      }
      await updateProviderGroup(selectedGroup.id, groupFormData);
      await fetchGroups();
      setIsGroupModalOpen(false);
      setSelectedGroup(null);
      setGroupFormData({
        name: '',
        description: '',
        color: '#6366F1',
        icon: 'users',
        isVip: false,
        priority: 0,
      });
      alert('تم تحديث المجموعة بنجاح');
    } catch (error) {
      console.error('Error updating group:', error);
      alert('فشل تحديث المجموعة');
    }
  };

  const handleDeleteGroup = async (groupId) => {
    if (!confirm('هل أنت متأكد من حذف هذه المجموعة؟ سيتم إزالة جميع المزوّدين من المجموعة.')) {
      return;
    }
    try {
      await deleteProviderGroup(groupId);
      await fetchGroups();
      await fetchProviders();
      alert('تم حذف المجموعة بنجاح');
    } catch (error) {
      console.error('Error deleting group:', error);
      alert('فشل حذف المجموعة');
    }
  };

  const handleAssignToGroup = async (groupId) => {
    if (selectedProvidersForGroup.length === 0) {
      alert('يرجى اختيار مزودين للتعيين');
      return;
    }
    try {
      const providerIds = selectedProvidersForGroup.map(p => p.id);
      await assignProvidersToGroup(providerIds, groupId || null);
      await fetchProviders();
      await fetchGroups();
      setSelectedProvidersForGroup([]);
      setIsAssignGroupModalOpen(false);
      alert('تم تعيين المزوّدين بنجاح');
    } catch (error) {
      console.error('Error assigning providers to group:', error);
      alert('فشل تعيين المزوّدين');
    }
  };

  const handleRemoveFromGroup = async (providerId) => {
    try {
      await removeProviderFromGroup(providerId);
      await fetchProviders();
      await fetchGroups();
      alert('تم إزالة المزود من المجموعة بنجاح');
    } catch (error) {
      console.error('Error removing provider from group:', error);
      alert('فشل إزالة المزود من المجموعة');
    }
  };

  const handleAddProvider = async () => {
    try {
      if (!providerFormData.firstName.trim() || !providerFormData.lastName.trim() || !providerFormData.phone.trim()) {
        alert('يرجى إكمال جميع الحقول المطلوبة (الاسم والرقم)');
        return;
      }

      if (providerFormData.services.length === 0) {
        alert('يرجى اختيار خدمة واحدة على الأقل');
        return;
      }

      if (!providerFormData.nationality) {
        alert('يرجى اختيار الجنسية');
        return;
      }

      setIsUploading(true);
      let idImageUrl = '';

      if (idImageFile) {
        try {
          const storageRef = ref(storage, `providers/${Date.now()}_${idImageFile.name}`);
          await uploadBytes(storageRef, idImageFile);
          idImageUrl = await getDownloadURL(storageRef);
        } catch (uploadError) {
          console.error('Image upload failed:', uploadError);
          alert('فشل رفع الصورة، سيتم إضافة المزود بدون صورة');
        }
      }

      await createManualProvider({
        ...providerFormData,
        idImage: idImageUrl
      });

      await fetchProviders();
      setIsAddProviderModalOpen(false);
      setProviderFormData({
        firstName: '',
        lastName: '',
        phone: '',
        email: '',
        nationality: '',
        services: [],
      });
      setIdImageFile(null);
      setIsUploading(false);
      alert('تم إضافة المزود بنجاح');
    } catch (error) {
      console.error('Error adding provider:', error);
      alert('فشل إضافة المزود');
    }
  };

  const openGroupModal = (group = null) => {
    if (group) {
      setSelectedGroup(group);
      setGroupFormData({
        name: group.name || '',
        description: group.description || '',
        color: group.color || '#6366F1',
        icon: group.icon || 'users',
        isVip: group.isVip || false,
        priority: group.priority || 0,
      });
    } else {
      setSelectedGroup(null);
      setGroupFormData({
        name: '',
        description: '',
        color: '#6366F1',
        icon: 'users',
        isVip: false,
        priority: 0,
      });
    }
    setIsGroupModalOpen(true);
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { text: 'قيد المراجعة', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
      approved: { text: 'موافق عليه', color: 'bg-green-100 text-green-700', icon: CheckCircle },
      rejected: { text: 'مرفوض', color: 'bg-red-100 text-red-700', icon: XCircle },
    };
    return badges[status] || { text: status, color: 'bg-gray-100 text-gray-700', icon: Clock };
  };

  const getTypeBadge = (type) => {
    const badges = {
      vip: { text: 'VIP', color: 'bg-purple-100 text-purple-700', icon: Star },
      general: { text: 'عام', color: 'bg-blue-100 text-blue-700', icon: UserCheck },
    };
    return badges[type] || { text: 'عام', color: 'bg-blue-100 text-blue-700', icon: UserCheck };
  };

  const getGroupBadge = (groupId) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return null;
    return {
      text: group.name,
      color: group.color || '#6366F1',
      isVip: group.isVip || false,
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">جاري التحميل...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-800 mb-2">إدارة المزودين</h1>
          <p className="text-gray-600">عرض وإدارة جميع مزودي الخدمة</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setIsAddProviderModalOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-all font-semibold shadow-md"
          >
            <Plus size={20} />
            إضافة مزود يدوياً
          </button>
          <button
            onClick={() => setShowGroupsSection(!showGroupsSection)}
            className="flex items-center gap-2 px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-all font-semibold shadow-md"
          >
            <Users size={20} />
            {showGroupsSection ? 'إخفاء المجموعات' : 'إدارة المجموعات'}
          </button>
        </div>
      </div>

      {/* Groups Management Section */}
      {showGroupsSection && (
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800">إدارة المجموعات</h2>
            <button
              onClick={() => openGroupModal()}
              className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-all"
            >
              <Plus size={18} />
              إضافة مجموعة جديدة
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map((group) => (
              <div
                key={group.id}
                className="border-2 border-gray-200 rounded-xl p-4 hover:border-purple-300 transition-all"
                style={{ borderLeftColor: group.color, borderLeftWidth: '4px' }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                      style={{ backgroundColor: group.color }}
                    >
                      <Users size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800">{group.name}</h3>
                      {group.isVip && (
                        <span className="text-xs text-purple-600 font-semibold">VIP</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openGroupModal(group)}
                      className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteGroup(group.id)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                {group.description && (
                  <p className="text-sm text-gray-600 mb-2">{group.description}</p>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">
                    عدد الأعضاء: <span className="font-semibold">{group.memberIds?.length || 0}</span>
                  </span>
                  <span className="text-gray-500">
                    الأولوية: <span className="font-semibold">{group.priority || 0}</span>
                  </span>
                </div>
              </div>
            ))}
            {groups.length === 0 && (
              <div className="col-span-full text-center py-8 text-gray-500">
                لا توجد مجموعات. قم بإضافة مجموعة جديدة.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-6">
        <div className="bg-white rounded-2xl p-4 md:p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <UserCheck className="text-blue-500" size={20} />
            <span className="text-xs md:text-sm text-gray-600">إجمالي المزودين</span>
          </div>
          <p className="text-2xl md:text-3xl font-black text-gray-800">{providers.length}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 md:p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Star className="text-purple-500" size={20} />
            <span className="text-xs md:text-sm text-gray-600">مزودين VIP</span>
          </div>
          <p className="text-2xl md:text-3xl font-black text-gray-800">
            {providers.filter((p) => p.type === 'vip').length}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-4 md:p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="text-green-500" size={20} />
            <span className="text-xs md:text-sm text-gray-600">نشطون</span>
          </div>
          <p className="text-2xl md:text-3xl font-black text-gray-800">
            {providers.filter((p) => p.isActive !== false).length}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-4 md:p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Users className="text-teal-500" size={20} />
            <span className="text-xs md:text-sm text-gray-600">المجموعات</span>
          </div>
          <p className="text-2xl md:text-3xl font-black text-gray-800">{groups.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-lg p-4 md:p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-3 md:gap-4">
          <div className="flex-1 relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="ابحث عن مزود..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-4 py-3 border-2 border-gray-200 rounded-lg focus:border-teal-400 focus:outline-none text-sm md:text-base"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full md:w-auto px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-teal-400 focus:outline-none text-sm md:text-base"
          >
            <option value="all">جميع الحالات</option>
            <option value="pending">قيد المراجعة</option>
            <option value="approved">موافق عليه</option>
            <option value="rejected">مرفوض</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full md:w-auto px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-teal-400 focus:outline-none text-sm md:text-base"
          >
            <option value="all">جميع الأنواع</option>
            <option value="vip">VIP</option>
            <option value="general">عام</option>
          </select>
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="w-full md:w-auto px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-teal-400 focus:outline-none text-sm md:text-base"
          >
            <option value="all">جميع المجموعات</option>
            <option value="no-group">بدون مجموعة</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Providers List */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">المزود</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">الخدمات</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">المجموعة</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">النوع</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">الحالة</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">التفعيل</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">التاريخ</th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredProviders.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
                    لا توجد نتائج
                  </td>
                </tr>
              ) : (
                filteredProviders.map((provider) => {
                  // استخدام approvalStatus بدلاً من status (status قد يكون "online"/"offline")
                  const approvalStatus = provider.approvalStatus || provider.status;
                  const statusBadge = getStatusBadge(approvalStatus);
                  const typeBadge = getTypeBadge(provider.type);
                  const groupBadge = getGroupBadge(provider.groupId);
                  const StatusIcon = statusBadge.icon;
                  const TypeIcon = typeBadge.icon;
                  return (
                    <tr key={provider.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-gray-800">
                              {provider.firstName} {provider.lastName}
                            </p>
                            {provider.registrationMethod === 'phone_otp' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                <Phone size={10} className="ml-1" />
                                OTP
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                            <Phone size={14} />
                            <span className="font-medium">{provider.phone}</span>
                          </div>
                          {provider.email ? (
                            <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                              <Mail size={14} />
                              <span>{provider.email}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 mt-1 text-xs text-gray-400 italic">
                              <Mail size={12} />
                              <span>لا يوجد بريد إلكتروني</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          {(() => {
                            // دعم البنية القديمة (array) والجديدة (object)
                            const services = provider.services || {};
                            let serviceList = [];

                            if (Array.isArray(services)) {
                              // البنية القديمة
                              serviceList = services.map(s => ({
                                id: typeof s === 'string' ? s : String(s),
                                status: 'approved'
                              }));
                            } else if (typeof services === 'object' && services !== null) {
                              // البنية الجديدة
                              serviceList = Object.entries(services)
                                .filter(([id, data]) => {
                                  // تجاهل إذا كان data هو array أو null
                                  return data !== null && !Array.isArray(data) && typeof data === 'object';
                                })
                                .map(([id, data]) => ({
                                  id: String(id),
                                  status: data?.status || 'pending',
                                }));
                            }

                            return serviceList.map((service) => {
                              // البحث عن اسم الخدمة من mainServices أو استخدام serviceNames القديم
                              const serviceId = String(service.id || '');
                              let serviceName = serviceId;

                              // البحث في الخدمات الرئيسية (emergency-services)
                              const mainService = mainServices.find(s =>
                                s.id === serviceId || s.serviceId === serviceId
                              );

                              if (mainService) {
                                serviceName = mainService.name;
                              } else {
                                // استخدام serviceNames القديم للتوافق مع الخدمات القديمة
                                const oldServiceNames = {
                                  tires: '🚗 كفرات',
                                  battery: '🔋 بطاريات',
                                  locksmith: '🔐 أقفال',
                                  fuel: '⛽ تعبئة وقود',
                                };
                                serviceName = oldServiceNames[serviceId] || serviceId;
                              }

                              const statusColors = {
                                approved: 'bg-green-100 text-green-700',
                                pending: 'bg-yellow-100 text-yellow-700',
                                rejected: 'bg-red-100 text-red-700',
                              };

                              return (
                                <span
                                  key={serviceId}
                                  className={`px-2 py-1 ${statusColors[service.status] || 'bg-gray-100 text-gray-700'} text-xs rounded-full`}
                                  title={`حالة: ${service.status === 'approved' ? 'مقبولة' : service.status === 'pending' ? 'قيد المراجعة' : 'مرفوضة'}`}
                                >
                                  {serviceName}
                                </span>
                              );
                            });
                          })()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {groupBadge ? (
                          <span
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold text-white"
                            style={{ backgroundColor: groupBadge.color }}
                          >
                            <Tag size={12} />
                            {groupBadge.text}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">بدون مجموعة</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${typeBadge.color}`}
                        >
                          <TypeIcon size={14} />
                          {typeBadge.text}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${statusBadge.color}`}
                        >
                          <StatusIcon size={14} />
                          {statusBadge.text}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => toggleProviderActivation(provider.id)}
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold transition-all ${provider.isActive !== false
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                            }`}
                        >
                          <Power size={14} />
                          {provider.isActive !== false ? 'نشط' : 'معطل'}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {provider.createdAt
                          ? (() => {
                            const date = new Date(provider.createdAt);
                            return isNaN(date.getTime()) ? '-' : format(date, 'dd MMM yyyy', { locale: ar });
                          })()
                          : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setSelectedProvider(provider)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                            title="عرض التفاصيل"
                          >
                            <Eye size={18} />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedProvidersForGroup([provider]);
                              setIsAssignGroupModalOpen(true);
                            }}
                            className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg"
                            title="تعيين لمجموعة"
                          >
                            <Users size={18} />
                          </button>
                          {provider.groupId && (
                            <button
                              onClick={() => handleRemoveFromGroup(provider.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                              title="إزالة من المجموعة"
                            >
                              <X size={18} />
                            </button>
                          )}
                          {(() => {
                            // استخدام approvalStatus بدلاً من status
                            const approvalStatus = provider.approvalStatus || provider.status;
                            return (
                              <>
                                {approvalStatus === 'pending' && (
                                  <>
                                    <button
                                      onClick={() => handleStatusChange(provider.id, 'approved')}
                                      className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all text-sm font-semibold"
                                    >
                                      قبول
                                    </button>
                                    <button
                                      onClick={() => handleStatusChange(provider.id, 'rejected')}
                                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all text-sm font-semibold"
                                    >
                                      رفض
                                    </button>
                                  </>
                                )}
                                {approvalStatus === 'approved' && (
                                  <>
                                    <button
                                      onClick={() => handleStatusChange(provider.id, 'rejected')}
                                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all text-sm font-semibold"
                                    >
                                      رفض
                                    </button>
                                    <button
                                      onClick={() => handleStatusChange(provider.id, 'pending')}
                                      className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-all text-sm font-semibold"
                                    >
                                      إعادة للمراجعة
                                    </button>
                                  </>
                                )}
                                {approvalStatus === 'rejected' && (
                                  <>
                                    <button
                                      onClick={() => handleStatusChange(provider.id, 'approved')}
                                      className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all text-sm font-semibold"
                                    >
                                      قبول
                                    </button>
                                    <button
                                      onClick={() => handleStatusChange(provider.id, 'pending')}
                                      className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-all text-sm font-semibold"
                                    >
                                      إعادة للمراجعة
                                    </button>
                                  </>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Provider Modal */}
      {isAddProviderModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-800">إضافة مزود جديد يدوياً</h2>
                <button
                  onClick={() => setIsAddProviderModalOpen(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4 text-right" dir="rtl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">الاسم الأول *</label>
                  <input
                    type="text"
                    value={providerFormData.firstName}
                    onChange={(e) => setProviderFormData({ ...providerFormData, firstName: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-teal-400 focus:outline-none"
                    placeholder="الاسم الأول"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">الاسم الأخير *</label>
                  <input
                    type="text"
                    value={providerFormData.lastName}
                    onChange={(e) => setProviderFormData({ ...providerFormData, lastName: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-teal-400 focus:outline-none"
                    placeholder="الاسم الأخير"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">الجنسية *</label>
                <select
                  value={providerFormData.nationality}
                  onChange={(e) => setProviderFormData({ ...providerFormData, nationality: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-teal-400 focus:outline-none"
                >
                  <option value="">اختر الجنسية</option>
                  {NATIONALITIES.map((nat) => (
                    <option key={nat.value} value={nat.value}>
                      {nat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">صورة الإقامة/الهوية (اختياري)</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 bg-gray-50 hover:bg-gray-100 transition-all text-center">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setIdImageFile(e.target.files[0])}
                    className="hidden"
                    id="id-image-upload"
                  />
                  <label htmlFor="id-image-upload" className="cursor-pointer flex flex-col items-center justify-center">
                    {idImageFile ? (
                      <div className="flex items-center gap-2 text-teal-600">
                        <CheckCircle size={24} />
                        <span className="font-semibold">{idImageFile.name}</span>
                      </div>
                    ) : (
                      <>
                        <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center mb-2">
                          <span className="text-2xl">📷</span>
                        </div>
                        <span className="text-gray-600 font-medium">اضغط لرفع صورة الإقامة</span>
                        <span className="text-gray-400 text-xs mt-1">PNG, JPG up to 5MB</span>
                      </>
                    )}
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">رقم الهاتف * (966XXXXXXXXX)</label>
                <div className="relative">
                  <input
                    type="tel"
                    value={providerFormData.phone}
                    onChange={(e) => setProviderFormData({ ...providerFormData, phone: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-teal-400 focus:outline-none"
                    placeholder="5XXXXXXXX"
                  />
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 border-r pr-2 ltr" dir="ltr">
                    +966
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">البريد الإلكتروني (اختياري)</label>
                <input
                  type="email"
                  value={providerFormData.email}
                  onChange={(e) => setProviderFormData({ ...providerFormData, email: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-teal-400 focus:outline-none"
                  placeholder="example@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-4">الخدمات المتاحة للمزود *</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto p-2 border-2 border-gray-100 rounded-xl">
                  {mainServices.map((service) => (
                    <label
                      key={service.id}
                      className={`flex items-center p-3 rounded-lg border-2 cursor-pointer transition-all ${providerFormData.services.includes(service.id)
                        ? 'border-teal-500 bg-teal-50'
                        : 'border-gray-100 bg-white hover:border-gray-300'
                        }`}
                    >
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={providerFormData.services.includes(service.id)}
                        onChange={(e) => {
                          const updatedServices = e.target.checked
                            ? [...providerFormData.services, service.id]
                            : providerFormData.services.filter(id => id !== service.id);
                          setProviderFormData({ ...providerFormData, services: updatedServices });
                        }}
                      />
                      <div className={`w-5 h-5 rounded border-2 ml-3 flex items-center justify-center ${providerFormData.services.includes(service.id)
                        ? 'bg-teal-500 border-teal-500'
                        : 'border-gray-300'
                        }`}>
                        {providerFormData.services.includes(service.id) && <CheckCircle size={14} className="text-white" />}
                      </div>
                      <span className="font-semibold text-gray-700">{service.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4 sticky bottom-0 bg-white">
                <button
                  onClick={handleAddProvider}
                  disabled={isUploading}
                  className={`flex-1 px-6 py-4 bg-teal-500 text-white rounded-xl hover:bg-teal-600 transition-all font-bold text-lg shadow-lg ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isUploading ? 'جاري الإضافة...' : 'إضافة المزود الآن'}
                </button>
                <button
                  onClick={() => setIsAddProviderModalOpen(false)}
                  className="flex-1 px-6 py-4 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-all font-bold text-lg"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Group Modal */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-800">
                  {selectedGroup ? 'تعديل المجموعة' : 'إضافة مجموعة جديدة'}
                </h2>
                <button
                  onClick={() => {
                    setIsGroupModalOpen(false);
                    setSelectedGroup(null);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">اسم المجموعة *</label>
                <input
                  type="text"
                  value={groupFormData.name}
                  onChange={(e) => setGroupFormData({ ...groupFormData, name: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-teal-400 focus:outline-none"
                  placeholder="مثال: مجموعة VIP المميزة"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">الوصف</label>
                <textarea
                  value={groupFormData.description}
                  onChange={(e) => setGroupFormData({ ...groupFormData, description: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-teal-400 focus:outline-none"
                  rows="3"
                  placeholder="وصف المجموعة..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">اللون</label>
                  <input
                    type="color"
                    value={groupFormData.color}
                    onChange={(e) => setGroupFormData({ ...groupFormData, color: e.target.value })}
                    className="w-full h-12 border-2 border-gray-200 rounded-lg cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">الأولوية</label>
                  <input
                    type="number"
                    value={groupFormData.priority}
                    onChange={(e) => setGroupFormData({ ...groupFormData, priority: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-teal-400 focus:outline-none"
                    min="0"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={groupFormData.isVip}
                  onChange={(e) => setGroupFormData({ ...groupFormData, isVip: e.target.checked })}
                  className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <label className="text-sm font-semibold text-gray-700">مجموعة VIP</label>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={selectedGroup ? handleUpdateGroup : handleCreateGroup}
                  className="flex-1 px-6 py-3 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-all font-semibold"
                >
                  {selectedGroup ? 'تحديث' : 'إنشاء'}
                </button>
                <button
                  onClick={() => {
                    setIsGroupModalOpen(false);
                    setSelectedGroup(null);
                  }}
                  className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all font-semibold"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Group Modal */}
      {isAssignGroupModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-800">تعيين لمجموعة</h2>
                <button
                  onClick={() => {
                    setIsAssignGroupModalOpen(false);
                    setSelectedProvidersForGroup([]);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">اختر المجموعة</label>
                <select
                  onChange={(e) => {
                    const groupId = e.target.value === 'none' ? null : e.target.value;
                    handleAssignToGroup(groupId);
                  }}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-teal-400 focus:outline-none"
                >
                  <option value="none">إزالة من المجموعات (عام)</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name} {group.isVip && '(VIP)'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600 mb-2">
                  المزوّدون المحددون: {selectedProvidersForGroup.length}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Provider Details Modal */}
      {selectedProvider && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 md:p-6">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="p-4 md:p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
              <div className="flex items-center justify-between">
                <h2 className="text-xl md:text-2xl font-bold text-gray-800">تفاصيل المزود</h2>
                <button
                  onClick={() => setSelectedProvider(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <XCircle size={24} />
                </button>
              </div>
            </div>
            <div className="p-4 md:p-6 space-y-4 md:space-y-6">
              <div>
                <h3 className="font-semibold text-gray-700 mb-2">الاسم</h3>
                <p className="text-gray-800">
                  {selectedProvider.firstName} {selectedProvider.lastName}
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-700 mb-2">رقم الهاتف</h3>
                <div className="flex items-center gap-2">
                  <p className="text-gray-800 font-medium">{selectedProvider.phone}</p>
                  {selectedProvider.registrationMethod === 'phone_otp' && (
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                      <Phone size={12} className="ml-1" />
                      تسجيل OTP
                    </span>
                  )}
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-gray-700 mb-2">البريد الإلكتروني</h3>
                {selectedProvider.email ? (
                  <p className="text-gray-800">{selectedProvider.email}</p>
                ) : (
                  <p className="text-gray-400 italic text-sm">لا يوجد بريد إلكتروني (تسجيل برقم الهاتف)</p>
                )}
              </div>
              {selectedProvider.groupId && (
                <div>
                  <h3 className="font-semibold text-gray-700 mb-2">المجموعة</h3>
                  {(() => {
                    const groupBadge = getGroupBadge(selectedProvider.groupId);
                    return groupBadge ? (
                      <span
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold text-white"
                        style={{ backgroundColor: groupBadge.color }}
                      >
                        <Tag size={14} />
                        {groupBadge.text}
                      </span>
                    ) : (
                      <span className="text-gray-400">بدون مجموعة</span>
                    );
                  })()}
                </div>
              )}
              <div>
                <h3 className="font-semibold text-gray-700 mb-4">إدارة الخدمات</h3>
                <div className="space-y-3">
                  {(() => {
                    // دعم البنية القديمة (array) والجديدة (object)
                    const services = selectedProvider.services || {};
                    let serviceList = [];

                    if (Array.isArray(services)) {
                      // البنية القديمة: تحويل إلى object
                      serviceList = services.map(s => ({
                        id: typeof s === 'string' ? s : String(s),
                        status: 'approved'
                      }));
                    } else if (typeof services === 'object' && services !== null) {
                      // البنية الجديدة
                      serviceList = Object.entries(services)
                        .filter(([id, data]) => {
                          // تجاهل إذا كان data هو array أو null
                          return data !== null && !Array.isArray(data) && typeof data === 'object';
                        })
                        .map(([id, data]) => ({
                          id: String(id),
                          status: data?.status || 'pending',
                          requestedAt: data?.requestedAt,
                          updatedAt: data?.updatedAt,
                        }));
                    }

                    return serviceList.length > 0 ? (
                      serviceList.map((service) => {
                        const serviceId = String(service.id || '');

                        // البحث عن اسم الخدمة من mainServices أو استخدام serviceNames القديم
                        let serviceName = serviceId;
                        const mainService = mainServices.find(s =>
                          s.id === serviceId || s.serviceId === serviceId
                        );

                        if (mainService) {
                          serviceName = mainService.name;
                        } else {
                          // استخدام serviceNames القديم للتوافق مع الخدمات القديمة
                          const oldServiceNames = {
                            tires: '🚗 خدمات الكفرات',
                            battery: '🔋 خدمات البطاريات',
                            locksmith: '🔐 فتح الأقفال',
                            fuel: '⛽ تعبئة الوقود',
                          };
                          serviceName = oldServiceNames[serviceId] || serviceId;
                        }

                        const handleServiceStatusChange = async (newStatus) => {
                          try {
                            await updateProviderServiceStatus(selectedProvider.id, serviceId, newStatus);
                            // تحديث الحالة في القائمة
                            setSelectedProvider(prev => {
                              const updatedServices = { ...prev.services };
                              if (updatedServices[serviceId]) {
                                updatedServices[serviceId] = {
                                  ...updatedServices[serviceId],
                                  status: newStatus,
                                  updatedAt: new Date().toISOString(),
                                };
                              }
                              return { ...prev, services: updatedServices };
                            });
                            // تحديث القائمة الرئيسية
                            await fetchProviders();
                            alert(`تم ${newStatus === 'approved' ? 'قبول' : newStatus === 'rejected' ? 'رفض' : 'إعادة'} الخدمة بنجاح`);
                          } catch (error) {
                            console.error('Error updating service status:', error);
                            alert('فشل تحديث حالة الخدمة');
                          }
                        };

                        return (
                          <div
                            key={serviceId}
                            className="border-2 border-gray-200 rounded-lg p-4 hover:border-teal-300 transition-all"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                {(() => {
                                  const serviceIcon = '📦'; // يمكن إضافة أيقونة من mainService.imageUrl لاحقاً
                                  return (
                                    <>
                                      <span className="text-2xl">{serviceIcon}</span>
                                      <div>
                                        <p className="font-semibold text-gray-800">
                                          {serviceName}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                          {service.status === 'approved' && '✅ مقبولة'}
                                          {service.status === 'pending' && '⏳ قيد المراجعة'}
                                          {service.status === 'rejected' && '❌ مرفوضة'}
                                        </p>
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>
                              <div className="flex items-center gap-2">
                                {service.status !== 'approved' && (
                                  <button
                                    onClick={() => handleServiceStatusChange('approved')}
                                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all text-sm font-semibold"
                                  >
                                    قبول
                                  </button>
                                )}
                                {service.status !== 'rejected' && (
                                  <button
                                    onClick={() => handleServiceStatusChange('rejected')}
                                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all text-sm font-semibold"
                                  >
                                    رفض
                                  </button>
                                )}
                                {service.status !== 'pending' && (
                                  <button
                                    onClick={() => handleServiceStatusChange('pending')}
                                    className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-all text-sm font-semibold"
                                  >
                                    إعادة للمراجعة
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-gray-500 text-center py-4">لا توجد خدمات</p>
                    );
                  })()}
                </div>
              </div>


              {/* ✅ Enhanced Documents Section with All Document Types */}
              {selectedProvider.documents && (Object.keys(selectedProvider.documents).length > 0) && (
                <div>
                  <h3 className="font-semibold text-gray-700 mb-4">المستندات والصور</h3>

                  {/* Personal Documents */}
                  {selectedProvider.documents.idImage && (
                    <div className="mb-6">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                          <span className="text-blue-600 text-sm">👤</span>
                        </div>
                        <h4 className="font-bold text-gray-700">المستندات الشخصية</h4>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <DocumentCard
                          title="الهوية / الإقامة"
                          imageUrl={selectedProvider.documents.idImage}
                          icon="🆔"
                        />
                      </div>
                    </div>
                  )}

                  {/* Equipment Section */}
                  {selectedProvider.documents.equipmentPhoto && (
                    <div className="mb-6">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                          <span className="text-orange-600 text-sm">🛠️</span>
                        </div>
                        <h4 className="font-bold text-gray-700">معدات العمل</h4>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <DocumentCard
                          title="صورة العدة"
                          imageUrl={selectedProvider.documents.equipmentPhoto}
                          icon="🔧"
                        />
                      </div>
                    </div>
                  )}

                  {/* Vehicle Photos Section */}
                  {(selectedProvider.documents.carPhotoFront ||
                    selectedProvider.documents.carPhotoSide ||
                    selectedProvider.documents.carPhotoRear) && (
                      <div className="mb-6">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                            <span className="text-green-600 text-sm">🚗</span>
                          </div>
                          <h4 className="font-bold text-gray-700">صور السيارة</h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {selectedProvider.documents.carPhotoFront && (
                            <DocumentCard
                              title="السيارة - أمامية"
                              imageUrl={selectedProvider.documents.carPhotoFront}
                              icon="🚙"
                            />
                          )}
                          {selectedProvider.documents.carPhotoSide && (
                            <DocumentCard
                              title="السيارة - جانبية"
                              imageUrl={selectedProvider.documents.carPhotoSide}
                              icon="🚐"
                            />
                          )}
                          {selectedProvider.documents.carPhotoRear && (
                            <DocumentCard
                              title="السيارة - خلفية"
                              imageUrl={selectedProvider.documents.carPhotoRear}
                              icon="🚚"
                            />
                          )}
                        </div>
                      </div>
                    )}

                  {/* Legal Documents Section */}
                  {(selectedProvider.documents.licensePhoto ||
                    selectedProvider.documents.registrationPhoto) && (
                      <div className="mb-6">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                            <span className="text-purple-600 text-sm">📄</span>
                          </div>
                          <h4 className="font-bold text-gray-700">المستندات القانونية</h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {selectedProvider.documents.licensePhoto && (
                            <DocumentCard
                              title="رخصة القيادة"
                              imageUrl={selectedProvider.documents.licensePhoto}
                              icon="🪪"
                            />
                          )}
                          {selectedProvider.documents.registrationPhoto && (
                            <DocumentCard
                              title="استمارة السيارة"
                              imageUrl={selectedProvider.documents.registrationPhoto}
                              icon="📋"
                            />
                          )}
                        </div>
                      </div>
                    )}
                </div>
              )}


              <div>
                <h3 className="font-semibold text-gray-700 mb-2">الإحصائيات</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">إجمالي الطلبات</p>
                    <p className="text-2xl font-bold text-gray-800">
                      {selectedProvider.stats?.totalOrders || 0}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">التقييم</p>
                    <p className="text-2xl font-bold text-gray-800">
                      {selectedProvider.stats?.rating || 0}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Document Card Component for displaying individual documents
const DocumentCard = ({ title, imageUrl, icon }) => {
  const [imageLoaded, setImageLoaded] = React.useState(false);
  const [imageError, setImageError] = React.useState(false);

  return (
    <div className="border-2 border-gray-200 rounded-xl p-4 hover:border-teal-300 transition-all hover:shadow-md bg-white">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{icon}</span>
        <p className="text-sm font-semibold text-gray-700">{title}</p>
      </div>

      <div className="relative bg-gray-50 rounded-lg overflow-hidden mb-3" style={{ minHeight: '180px' }}>
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
          </div>
        )}

        {imageError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
            <span className="text-3xl mb-2">📷</span>
            <span className="text-xs">فشل تحميل الصورة</span>
          </div>
        ) : (
          <img
            src={imageUrl}
            alt={title}
            className={`w-full h-48 object-contain rounded transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
        )}
      </div>

      <a
        href={imageUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-center text-sm text-teal-600 hover:text-teal-700 font-semibold hover:underline transition-colors"
      >
        فتح في تبويب جديد ↗
      </a>
    </div>
  );
};
