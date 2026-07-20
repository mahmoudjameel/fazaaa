import React, { useEffect, useState } from 'react';
import {
  Search, CheckCircle, XCircle, Clock, Eye, Phone, Mail, Star, Power,
  UserCheck, Users, Plus, Edit2, Trash2, Tag, X, FileText, ShieldBan, ShieldOff, Loader2
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  getAllProviders,
  getProviderById,
  updateProvider,
  updateProviderStatus,
  getAllProviderGroups,
  createProviderGroup,
  updateProviderGroup,
  deleteProviderGroup,
  assignProvidersToGroup,
  removeProviderFromGroup,
  updateProviderServiceStatus,
  approveProviderWithAllServices,
  removeProviderService,
  removeProviderDocument,
  addOrUpdateProviderDocument,
  getProviderOrderStats,
  toggleProviderVIP,
  getProviderWalletHistory,
  adjustProviderWallet,
  repairDuplicateProviders,
  repairApprovedProvidersPendingServices,
  permanentlyDeleteProvider,
  getProviderBlocks,
  unblockProviderForCustomer,
  BLOCK_REASON_LABELS,
} from '../services/adminService';
import ProviderProfileRequests from './ProviderProfileRequests';
import {
  resolveProfileDocuments,
  listDocumentsForDisplay,
  getDocumentLabel,
} from '../utils/documentUtils';
import { doc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../services/firebase';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import {
  resolveProviderWalletBalance,
  withNormalizedProviderWallet,
  isLowWalletBalance,
  LOW_BALANCE_THRESHOLD,
} from '../utils/providerWallet';
import SAUDI_CITIES_RAW from '../services/cities.json';

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

const SAUDI_CITIES = [...SAUDI_CITIES_RAW]
  .sort((a, b) => (a.name || '').localeCompare((b.name || ''), 'ar'))
  .map((city) => ({ value: city.id, label: city.name }));

const DOCUMENT_TYPE_OPTIONS = [
  { key: 'idImage', label: 'الهوية / الإقامة' },
  { key: 'equipmentPhoto', label: 'صورة العدة' },
];

export const Providers = () => {
  const location = useLocation();
  const [providers, setProviders] = useState([]);
  const [filteredProviders, setFilteredProviders] = useState([]);
  const [groups, setGroups] = useState([]);
  const [mainServices, setMainServices] = useState([]); // الخدمات الرئيسية من emergency-services
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [nationalityFilter, setNationalityFilter] = useState('all');
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [selectedProvidersForGroup, setSelectedProvidersForGroup] = useState([]);
  const [lowBalanceFilter, setLowBalanceFilter] = useState(false);
  const [hasAddPermission, setHasAddPermission] = useState(false);
  const [providersSection, setProvidersSection] = useState('list'); // 'list' | 'profile_requests'
  const navigate = useNavigate();

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
  const [isUploading, setIsUploading] = useState(false);

  // Provider Detail Modal State
  const [activeTab, setActiveTab] = useState('info'); // 'info', 'wallet', 'orders'
  const [walletHistory, setWalletHistory] = useState([]);
  const [loadingWallet, setLoadingWallet] = useState(false);
  const [orderStats, setOrderStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [ordersFilter, setOrdersFilter] = useState('all');
  const [walletAdjustment, setWalletAdjustment] = useState({ amount: '', type: 'addition', reason: '' });
  const [walletAmountError, setWalletAmountError] = useState('');
  const [isAdjustingWallet, setIsAdjustingWallet] = useState(false);
  const [updatingServiceId, setUpdatingServiceId] = useState(null);
  const [editProviderForm, setEditProviderForm] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [repairingDuplicates, setRepairingDuplicates] = useState(false);
  const [repairingServices, setRepairingServices] = useState(false);
  const [approvingAll, setApprovingAll] = useState(false);
  const [deletingDocKey, setDeletingDocKey] = useState(null);
  const [removingServiceId, setRemovingServiceId] = useState(null);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [addDocType, setAddDocType] = useState(DOCUMENT_TYPE_OPTIONS[0].key);
  const [addDocFile, setAddDocFile] = useState(null);
  const [showDeleteProviderModal, setShowDeleteProviderModal] = useState(false);
  const [deletingProvider, setDeletingProvider] = useState(false);
  const [providerBlocks, setProviderBlocks] = useState([]);
  const [loadingProviderBlocks, setLoadingProviderBlocks] = useState(false);
  const [unblockingBlockKey, setUnblockingBlockKey] = useState(null);
  const isSuperAdmin = typeof window !== 'undefined' && localStorage.getItem('admin_role') === 'super_admin';

  useEffect(() => {
    if (selectedProvider) {
      setEditProviderForm(null);
      setAddDocFile(null);
      setAddDocType(DOCUMENT_TYPE_OPTIONS[0].key);
    }
  }, [selectedProvider?.id]);

  useEffect(() => {
    fetchProviders();
    fetchGroups();
    fetchMainServices();

    // التحقق من الصلاحيات
    const role = localStorage.getItem('admin_role');
    const permissionsStr = localStorage.getItem('admin_permissions');
    if (role === 'super_admin') {
      setHasAddPermission(true);
    } else if (permissionsStr) {
      try {
        const permissions = JSON.parse(permissionsStr);
        setHasAddPermission(permissions.includes('add_provider') || permissions.includes('all'));
      } catch (e) {
        console.error('Error parsing permissions', e);
      }
    }

    // Parse query params for dashboard deep links
    const params = new URLSearchParams(location.search);
    const status = params.get('status');
    if (status === 'active') {
      setStatusFilter('approved');
      // Note: We might need a separate bit of state for isActive filter if we want to be exact
    } else if (status) {
      setStatusFilter(status);
    }
  }, [location.search]);

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
  }, [providers, mainServices, searchTerm, statusFilter, typeFilter, groupFilter, serviceFilter, cityFilter, nationalityFilter, lowBalanceFilter]);

  const getProviderServiceList = (provider) => {
    const services = provider?.services || {};

    if (Array.isArray(services)) {
      return services.map((s) => ({
        id: String(typeof s === 'string' ? s : s?.id || s),
        status: 'approved',
      }));
    }

    if (typeof services === 'object' && services !== null) {
      return Object.entries(services)
        .filter(([, data]) => data !== null && !Array.isArray(data) && typeof data === 'object')
        .map(([id, data]) => ({
          id: String(id),
          status: data?.status || 'pending',
        }));
    }

    return [];
  };

  const getServiceNameById = (serviceId) => {
    const normalizedId = String(serviceId || '');
    const mainService = mainServices.find((s) => s.id === normalizedId || s.serviceId === normalizedId);
    if (mainService) return mainService.name;

    const oldServiceNames = {
      tires: '🚗 كفرات',
      battery: '🔋 بطاريات',
      locksmith: '🔐 أقفال',
      fuel: '⛽ تعبئة وقود',
    };

    return oldServiceNames[normalizedId] || normalizedId;
  };

  const getServiceFilterOptions = () => {
    const map = new Map();

    mainServices.forEach((service) => {
      const id = String(service.id || service.serviceId || '');
      if (id) map.set(id, service.name || id);
    });

    providers.forEach((provider) => {
      getProviderServiceList(provider).forEach((service) => {
        const id = String(service.id || '');
        if (!id || map.has(id)) return;
        map.set(id, getServiceNameById(id));
      });
    });

    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  };

  const normalizeCityText = (value) => String(value || '').trim().toLowerCase();

  const fetchProviders = async () => {
    try {
      const result = await getAllProviders();
      const normalized = (result.providers || []).map((p) => withNormalizedProviderWallet(p));
      setProviders(normalized);
    } catch (error) {
      console.error('Error fetching providers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePermanentDeleteProvider = async () => {
    if (!selectedProvider) return;
    setDeletingProvider(true);
    try {
      await permanentlyDeleteProvider(selectedProvider.id);
      alert('تم', 'تم حذف المزود');
      setShowDeleteProviderModal(false);
      setSelectedProvider(null);
      await fetchProviders();
    } catch (error) {
      const msg = error?.message || error?.details || 'فشل الحذف';
      alert('خطأ', msg);
    } finally {
      setDeletingProvider(false);
    }
  };

  useEffect(() => {
    if (selectedProvider?.id) {
      fetchWalletData();
      fetchOrderStats();
      fetchProviderBlocks();
      setActiveTab('info');
    } else {
      setProviderBlocks([]);
    }
  }, [selectedProvider?.id]);

  const fetchProviderBlocks = async () => {
    if (!selectedProvider?.id) return;
    setLoadingProviderBlocks(true);
    try {
      const result = await getProviderBlocks(selectedProvider.id);
      if (result.success) {
        setProviderBlocks(result.blocks || []);
      } else {
        setProviderBlocks([]);
      }
    } catch (error) {
      console.error('Error fetching provider blocks:', error);
      setProviderBlocks([]);
    } finally {
      setLoadingProviderBlocks(false);
    }
  };

  const handleUnblockProvider = async (customerId, providerId) => {
    const key = `${customerId}:${providerId}`;
    if (!window.confirm('رفع الحظر؟ سيتمكن المزود من استقبال طلبات هذا العميل فوراً.')) return;
    setUnblockingBlockKey(key);
    try {
      await unblockProviderForCustomer(customerId, providerId);
      setProviderBlocks((prev) => prev.filter(
        (b) => !(b.customerId === customerId && b.providerId === providerId)
      ));
    } catch (error) {
      console.error('Unblock error:', error);
      alert(error?.message || 'فشل رفع الحظر');
    } finally {
      setUnblockingBlockKey(null);
    }
  };

  const formatBlockUntil = (block) => {
    if (!block.blockedUntilMs) return '—';
    const d = new Date(block.blockedUntilMs);
    return isNaN(d.getTime()) ? '—' : format(d, 'dd MMM yyyy, HH:mm', { locale: ar });
  };

  const fetchWalletData = async () => {
    if (!selectedProvider?.id) return;
    const providerId = selectedProvider.id;
    setLoadingWallet(true);
    try {
      const [historyResult, providerResult] = await Promise.all([
        getProviderWalletHistory(providerId),
        getProviderById(providerId),
      ]);

      const history = historyResult.success ? historyResult.history : [];
      setWalletHistory(history);

      if (providerResult.success && providerResult.provider) {
        const normalized = withNormalizedProviderWallet(providerResult.provider, history);
        setSelectedProvider((prev) => (prev?.id === providerId ? normalized : prev));
        setProviders((prev) => prev.map((p) => (p.id === providerId ? normalized : p)));
      } else if (history.length > 0) {
        setSelectedProvider((prev) =>
          prev?.id === providerId ? withNormalizedProviderWallet(prev, history) : prev
        );
      }
    } catch (error) {
      console.error('Error fetching wallet data:', error);
    } finally {
      setLoadingWallet(false);
    }
  };

  const fetchOrderStats = async () => {
    if (!selectedProvider) return;
    setLoadingStats(true);
    setOrdersFilter('all');
    try {
      const result = await getProviderOrderStats(selectedProvider.id);
      if (result.success) {
        setOrderStats(result);
      }
    } catch (error) {
      console.error('Error fetching order stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  const refreshSelectedProvider = async () => {
    if (!selectedProvider) return;
    try {
      const res = await getProviderById(selectedProvider.id);
      if (res.success && res.provider) {
        setSelectedProvider(res.provider);
        setProviders(prev => prev.map(p => p.id === res.provider.id ? res.provider : p));
      }
    } catch (e) {
      console.error('Refresh provider error', e);
    }
  };

  const handleUpdateServiceStatus = async (serviceId, status) => {
    if (!selectedProvider) return;
    setUpdatingServiceId(`${serviceId}:${status}`);
    try {
      await updateProviderServiceStatus(selectedProvider.id, serviceId, status);
      await refreshSelectedProvider();
      alert(status === 'approved' ? 'تم إضافة/تفعيل الخدمة للمزوّد بنجاح' : 'تم تحديث حالة الخدمة بنجاح');
    } catch (error) {
      console.error('Error updating provider service:', error);
      alert('فشل تحديث الخدمة، حاول مرة أخرى');
    } finally {
      setUpdatingServiceId(null);
    }
  };

  const handleRemoveService = async (serviceId) => {
    if (!selectedProvider || !window.confirm('هل أنت متأكد من حذف هذه الخدمة من المزود؟')) return;
    setRemovingServiceId(serviceId);
    try {
      await removeProviderService(selectedProvider.id, serviceId);
      await refreshSelectedProvider();
      alert('تم حذف الخدمة من المزود');
    } catch (error) {
      console.error('Error removing provider service:', error);
      alert('فشل حذف الخدمة');
    } finally {
      setRemovingServiceId(null);
    }
  };

  const handleDeleteDocument = async (docKey) => {
    if (!selectedProvider || !window.confirm('هل أنت متأكد من حذف هذا المستند/الصورة؟')) return;
    setDeletingDocKey(docKey);
    try {
      await removeProviderDocument(selectedProvider.id, docKey);
      await refreshSelectedProvider();
      alert('تم حذف المستند');
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('فشل حذف المستند');
    } finally {
      setDeletingDocKey(null);
    }
  };

  const getFileType = (file) => {
    if (!file) return 'image';
    const t = (file.type || '').toLowerCase();
    if (t.includes('pdf')) return 'pdf';
    if (t.includes('word') || t.includes('document') || file.name?.toLowerCase().endsWith('.doc') || file.name?.toLowerCase().endsWith('.docx')) return 'word';
    return 'image';
  };

  const handleAddDocument = async (e) => {
    e.preventDefault();
    if (!selectedProvider || !addDocFile) {
      alert('اختر نوع المستند وملفاً لرفعه');
      return;
    }
    setUploadingDocument(true);
    try {
      const path = `providers/${selectedProvider.id}/documents/${addDocType}_${Date.now()}_${addDocFile.name}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, addDocFile);
      const url = await getDownloadURL(storageRef);
      const type = getFileType(addDocFile);
      await addOrUpdateProviderDocument(selectedProvider.id, addDocType, type === 'image' ? url : { url, type });
      await refreshSelectedProvider();
      setAddDocFile(null);
      alert('تم إضافة المستند بنجاح');
    } catch (error) {
      console.error('Error adding document:', error);
      alert('فشل رفع المستند: ' + (error.message || 'حاول مرة أخرى'));
    } finally {
      setUploadingDocument(false);
    }
  };

  const handleSaveEditProvider = async (e) => {
    e.preventDefault();
    if (!selectedProvider || !editProviderForm) return;
    setSavingEdit(true);
    try {
      await updateProvider(selectedProvider.id, {
        firstName: editProviderForm.firstName,
        lastName: editProviderForm.lastName,
        phone: editProviderForm.phone,
        email: editProviderForm.email || null,
        nationality: editProviderForm.nationality,
        city: editProviderForm.city || '',
      });
      await refreshSelectedProvider();
      setEditProviderForm(null);
      alert('تم حفظ التعديلات');
    } catch (error) {
      console.error('Error updating provider:', error);
      alert('فشل حفظ التعديلات');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleAdjustWallet = async (e) => {
    e.preventDefault();
    const rawAmount = Number(walletAdjustment.amount);

    // التحقق من صحة المبلغ: مطلوب، أكبر من صفر، ومضاعفات ٥ ريال
    if (!walletAdjustment.amount || isNaN(rawAmount)) {
      setWalletAmountError('يرجى إدخال المبلغ');
      return;
    }
    if (rawAmount <= 0) {
      setWalletAmountError('المبلغ يجب أن يكون أكبر من صفر');
      return;
    }
    if (walletAdjustment.type === 'addition' || walletAdjustment.type === 'compensation') {
      if (rawAmount % 5 !== 0) {
        setWalletAmountError('المبلغ يجب أن يكون من مضاعفات ٥ ر.س (٥، ١٠، ١٥، ٢٠ ...)');
        return;
      }
    }
    if (!walletAdjustment.reason) {
      setWalletAmountError('');
      alert('يرجى كتابة سبب العملية');
      return;
    }

    setWalletAmountError('');

    setIsAdjustingWallet(true);
    try {
      const result = await adjustProviderWallet(
        selectedProvider.id,
        walletAdjustment.amount,
        walletAdjustment.type,
        walletAdjustment.reason
      );

      if (result.success) {
        alert('تم تحديث الرصيد بنجاح');
        setWalletAdjustment({ amount: '', type: 'addition', reason: '' });
        // Update local state
        const updatedProvider = { ...selectedProvider };
        if (!updatedProvider.wallet) updatedProvider.wallet = {};
        updatedProvider.wallet.balance = result.newBalance;
        setSelectedProvider(updatedProvider);
        setProviders(prev => prev.map(p => p.id === updatedProvider.id ? updatedProvider : p));
        fetchWalletData();
      }
    } catch (error) {
      alert('حدث خطأ: ' + error.message);
    } finally {
      setIsAdjustingWallet(false);
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

    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        (p.firstName + ' ' + p.lastName).toLowerCase().includes(searchLower) ||
        p.phone?.includes(searchTerm) ||
        p.email?.toLowerCase().includes(searchLower)
      );
    }

    // فلتر الرصيد المنخفض: 25 ريال فأقل — للمزودين المفعّلين فقط (معتمدين)
    // الحسابات الجديدة/قيد المراجعة غالباً رصيدها 0 ولا تُحسب هنا
    if (lowBalanceFilter) {
      filtered = filtered.filter((p) => {
        const approvalStatus = p.approvalStatus || p.status;
        if (approvalStatus !== 'approved') return false;
        return isLowWalletBalance(p);
      });
      filtered = [...filtered].sort(
        (a, b) => resolveProviderWalletBalance(a) - resolveProviderWalletBalance(b)
      );
    }

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

    if (serviceFilter !== 'all') {
      filtered = filtered.filter((p) => {
        const providerApprovalStatus = p.approvalStatus || p.status;
        if (providerApprovalStatus !== 'approved') return false;

        const providerServices = getProviderServiceList(p);
        return providerServices.some((service) => String(service.id) === String(serviceFilter) && service.status === 'approved');
      });
    }

    if (cityFilter !== 'all') {
      // اسم المدينة العربي للفلتر المحدد
      const selectedCityLabel =
        SAUDI_CITIES.find((city) => city.value === cityFilter)?.label || cityFilter;
      const selectedCityValueNorm = normalizeCityText(cityFilter);
      const selectedCityLabelNorm = normalizeCityText(selectedCityLabel);

      filtered = filtered.filter((p) => {
        // ① مطابقة cityName (الاسم العربي المخزون مباشرة — المزودون الجدد)
        if (p.cityName) {
          const providerCityNameNorm = normalizeCityText(p.cityName);
          if (providerCityNameNorm === selectedCityLabelNorm) return true;
        }
        // ② مطابقة city عبر ID أو بحث في SAUDI_CITIES (المزودون القدامى)
        const providerCityRaw = p.city || '';
        if (!providerCityRaw) return false;
        const providerCityLabel =
          SAUDI_CITIES.find((city) => city.value === providerCityRaw)?.label || providerCityRaw;
        return (
          normalizeCityText(providerCityRaw) === selectedCityValueNorm ||
          normalizeCityText(providerCityLabel) === selectedCityLabelNorm
        );
      });
    }

    if (nationalityFilter !== 'all') {
      if (nationalityFilter === 'unset') {
        filtered = filtered.filter((p) => !p.nationality);
      } else {
        const selectedNat =
          NATIONALITIES.find((n) => n.value === nationalityFilter) || null;
        const selectedLabel = selectedNat?.label || nationalityFilter;
        filtered = filtered.filter((p) => {
          const raw = (p.nationality || '').toString().trim();
          if (!raw) return false;
          return (
            raw === nationalityFilter ||
            raw === selectedLabel ||
            raw.toLowerCase() === nationalityFilter.toLowerCase()
          );
        });
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

  const handleApproveProviderAndAllServices = async () => {
    if (!selectedProvider) return;
    if (!window.confirm('سيتم قبول المزود واعتماد جميع خدماته دفعة واحدة. هل تريد المتابعة؟')) return;
    setApprovingAll(true);
    try {
      await approveProviderWithAllServices(selectedProvider.id);
      await Promise.all([fetchProviders(), refreshSelectedProvider()]);
      alert('تم', 'تم قبول المزود وجميع خدماته بنجاح');
    } catch (error) {
      console.error('Approve all error:', error);
      alert('خطأ', 'تعذر تنفيذ القبول الشامل');
    } finally {
      setApprovingAll(false);
    }
  };

  // قبول سريع من قائمة المزودين — يقبل المزود + جميع خدماته دفعة واحدة
  const handleQuickApproveAll = async (providerId) => {
    if (!window.confirm('سيتم قبول المزود واعتماد جميع خدماته دفعة واحدة. هل تريد المتابعة؟')) return;
    try {
      const result = await approveProviderWithAllServices(providerId);
      await fetchProviders();
      if (selectedProvider?.id === providerId) {
        await refreshSelectedProvider();
      } else if (result?.services) {
        setProviders((prev) =>
          prev.map((p) =>
            p.id === providerId
              ? { ...p, approvalStatus: 'approved', status: 'approved', services: result.services }
              : p
          )
        );
      }
      alert('تم قبول المزود وجميع خدماته بنجاح');
    } catch (error) {
      console.error('Quick approve all error:', error);
      alert('فشل قبول المزود');
    }
  };

  const handleRepairApprovedServices = async () => {
    if (
      !window.confirm(
        'سيتم اعتماد جميع الخدمات للمزودين المعتمدين مسبقاً وخدماتهم ما زالت «قيد المراجعة». هل تريد المتابعة؟'
      )
    ) {
      return;
    }
    setRepairingServices(true);
    try {
      const result = await repairApprovedProvidersPendingServices();
      await fetchProviders();
      if (selectedProvider) await refreshSelectedProvider();
      alert(
        `تمت المزامنة\n\n` +
          `عدد المزودين المفحوصين: ${result.scanned}\n` +
          `عدد المزودين الذين تم إصلاح خدماتهم: ${result.fixed}`
      );
    } catch (error) {
      console.error('Repair approved services error:', error);
      alert('فشل مزامنة خدمات المزودين المعتمدين');
    } finally {
      setRepairingServices(false);
    }
  };

  const toggleProviderType = async (providerId) => {
    try {
      const provider = providers.find(p => p.id === providerId);
      const newType = provider.type === 'vip' ? 'general' : 'vip';
      const providerRef = doc(db, 'providers', providerId);
      const now = new Date().toISOString();
      await updateDoc(providerRef, {
        type: newType,
        updatedAt: now
      });

      const updatedProviders = providers.map(p =>
        p.id === providerId ? { ...p, type: newType, updatedAt: now } : p
      );
      setProviders(updatedProviders);

      if (selectedProvider && selectedProvider.id === providerId) {
        setSelectedProvider(prev => ({ ...prev, type: newType, updatedAt: now }));
      }
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

  const handleRepairDuplicates = async () => {
    if (!window.confirm('سيتم فحص جميع المزودين ودمج السجلات المكررة حسب رقم الجوال. هل تريد المتابعة؟')) return;
    setRepairingDuplicates(true);
    try {
      const result = await repairDuplicateProviders();
      await fetchProviders();
      alert(
        `تم الإصلاح بنجاح\n\n` +
        `عدد السجلات المفحوصة: ${result.scanned}\n` +
        `مجموعات التكرار: ${result.duplicateGroups}\n` +
        `السجلات المدمجة: ${result.mergedRecords}\n` +
        `الطلبات التي تم تصحيحها: ${result.fixedRequests}`
      );
    } catch (error) {
      console.error('Repair duplicates error:', error);
      alert('فشل إصلاح التكرارات');
    } finally {
      setRepairingDuplicates(false);
    }
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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-800 mb-2">إدارة المزودين</h1>
          <p className="text-gray-600">عرض وإدارة جميع مزودي الخدمة</p>
        </div>
        <div className="flex gap-3">
          {hasAddPermission && (
            <button
              onClick={() => navigate('/admin/add-provider')}
              className="flex items-center gap-2 px-6 py-3 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-all font-semibold shadow-md"
            >
              <Plus size={20} />
              إضافة مزود يدوياً
            </button>
          )}
          <button
            onClick={handleRepairDuplicates}
            disabled={repairingDuplicates}
            className="flex items-center gap-2 px-6 py-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-all font-semibold shadow-md disabled:opacity-60"
          >
            <Tag size={20} />
            {repairingDuplicates ? 'جاري الإصلاح...' : 'إصلاح التكرار'}
          </button>
          <button
            onClick={handleRepairApprovedServices}
            disabled={repairingServices}
            className="flex items-center gap-2 px-6 py-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-all font-semibold shadow-md disabled:opacity-60"
            title="اعتماد خدمات المزودين المعتمدين الذين ما زالت خدماتهم قيد المراجعة"
          >
            <CheckCircle size={20} />
            {repairingServices ? 'جاري المزامنة...' : 'مزامنة خدمات المعتمدين'}
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

      {/* تبويب: قائمة المزودين | طلبات تعديل البروفايل */}
      <div className="flex gap-2 mb-6">
        <button
          type="button"
          onClick={() => setProvidersSection('list')}
          className={`px-5 py-2.5 rounded-xl font-bold transition-all ${providersSection === 'list' ? 'bg-teal-500 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'}`}
        >
          قائمة المزودين
        </button>
        <button
          type="button"
          onClick={() => setProvidersSection('profile_requests')}
          className={`px-5 py-2.5 rounded-xl font-bold transition-all ${providersSection === 'profile_requests' ? 'bg-teal-500 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'}`}
        >
          طلبات تعديل البروفايل
        </button>
      </div>

      {providersSection === 'profile_requests' ? (
        <ProviderProfileRequests />
      ) : (
        <>
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
          <div className="bg-white rounded-2xl shadow-lg p-4 md:p-6 mb-6 overflow-hidden">
            <div className="flex flex-col gap-3">
              <div className="relative w-full min-w-0">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="ابحث عن مزود..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pr-10 pl-4 py-3 border-2 border-gray-200 rounded-lg focus:border-teal-400 focus:outline-none text-sm md:text-base"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full min-w-0 px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-teal-400 focus:outline-none text-sm md:text-base"
                >
                  <option value="all">جميع الحالات</option>
                  <option value="pending">قيد المراجعة</option>
                  <option value="approved">موافق عليه</option>
                  <option value="rejected">مرفوض</option>
                </select>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full min-w-0 px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-teal-400 focus:outline-none text-sm md:text-base"
                >
                  <option value="all">جميع الأنواع</option>
                  <option value="vip">VIP</option>
                  <option value="general">عام</option>
                </select>
                <select
                  value={groupFilter}
                  onChange={(e) => setGroupFilter(e.target.value)}
                  className="w-full min-w-0 px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-teal-400 focus:outline-none text-sm md:text-base"
                >
                  <option value="all">جميع المجموعات</option>
                  <option value="no-group">بدون مجموعة</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
                <select
                  value={serviceFilter}
                  onChange={(e) => setServiceFilter(e.target.value)}
                  className="w-full min-w-0 px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-teal-400 focus:outline-none text-sm md:text-base"
                >
                  <option value="all">جميع الخدمات</option>
                  {getServiceFilterOptions().map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </select>
                <select
                  value={cityFilter}
                  onChange={(e) => setCityFilter(e.target.value)}
                  className="w-full min-w-0 px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-teal-400 focus:outline-none text-sm md:text-base"
                >
                  <option value="all">جميع مدن العمل</option>
                  {SAUDI_CITIES.map((city) => (
                    <option key={city.value} value={city.value}>
                      {city.label}
                    </option>
                  ))}
                </select>
                <select
                  value={nationalityFilter}
                  onChange={(e) => setNationalityFilter(e.target.value)}
                  className="w-full min-w-0 px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-teal-400 focus:outline-none text-sm md:text-base"
                >
                  <option value="all">جميع الجنسيات</option>
                  <option value="unset">بدون جنسية</option>
                  {NATIONALITIES.map((n) => (
                    <option key={n.value} value={n.value}>
                      {n.label}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-2 px-4 py-3 bg-red-50 rounded-lg border border-red-100 sm:col-span-2 lg:col-span-1 xl:col-span-2 min-w-0">
                  <input
                    type="checkbox"
                    id="lowBalance"
                    checked={lowBalanceFilter}
                    onChange={(e) => setLowBalanceFilter(e.target.checked)}
                    className="w-4 h-4 flex-shrink-0 text-red-600 rounded focus:ring-red-500 cursor-pointer"
                  />
                  <label htmlFor="lowBalance" className="text-sm font-bold text-red-700 cursor-pointer truncate">
                    رصيد منخفض — مفعّلين ({LOW_BALANCE_THRESHOLD} فأقل)
                  </label>
                  {lowBalanceFilter && (
                    <span className="text-xs font-semibold text-red-600 bg-white px-2 py-0.5 rounded-full border border-red-100 flex-shrink-0">
                      {filteredProviders.length}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Providers List */}
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">المزود</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">الرصيد</th>
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
                      <td colSpan="9" className="px-6 py-12 text-center text-gray-500">
                        {lowBalanceFilter
                          ? `لا يوجد مزودون مفعّلون برصيد ${LOW_BALANCE_THRESHOLD} ريال أو أقل`
                          : 'لا توجد نتائج'}
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
                      const walletBalance = resolveProviderWalletBalance(provider);
                      const isLowBalance = isLowWalletBalance(provider);
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
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                                isLowBalance
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-emerald-50 text-emerald-700'
                              }`}
                            >
                              {walletBalance.toFixed(2)} ر.س
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-2">
                              {(() => {
                                const serviceList = getProviderServiceList(provider);

                                return serviceList.map((service) => {
                                  const serviceId = String(service.id || '');
                                  const serviceName = getServiceNameById(serviceId);

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
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleProviderType(provider.id);
                              }}
                              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold transition-all hover:opacity-80 ${typeBadge.color}`}
                              title="تبديل النوع (VIP / عام)"
                            >
                              <TypeIcon size={14} />
                              {typeBadge.text}
                            </button>
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
                                          onClick={() => handleQuickApproveAll(provider.id)}
                                          className="inline-flex items-center gap-1.5 min-w-[88px] justify-center px-3 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 shadow-sm transition-all text-xs font-bold"
                                          title="قبول المزود وجميع خدماته دفعة واحدة"
                                        >
                                          <CheckCircle size={14} />
                                          قبول
                                        </button>
                                        <button
                                          onClick={() => handleStatusChange(provider.id, 'rejected')}
                                          className="inline-flex items-center gap-1.5 min-w-[88px] justify-center px-3 py-2 bg-rose-600 text-white rounded-xl hover:bg-rose-700 shadow-sm transition-all text-xs font-bold"
                                        >
                                          <XCircle size={14} />
                                          رفض
                                        </button>
                                      </>
                                    )}
                                    {approvalStatus === 'approved' && (
                                      <>
                                        <button
                                          onClick={() => handleStatusChange(provider.id, 'rejected')}
                                          className="inline-flex items-center gap-1.5 min-w-[88px] justify-center px-3 py-2 bg-rose-600 text-white rounded-xl hover:bg-rose-700 shadow-sm transition-all text-xs font-bold"
                                        >
                                          <XCircle size={14} />
                                          رفض
                                        </button>
                                        <button
                                          onClick={() => handleStatusChange(provider.id, 'pending')}
                                          className="inline-flex items-center gap-1.5 min-w-[110px] justify-center px-3 py-2 bg-amber-500 text-white rounded-xl hover:bg-amber-600 shadow-sm transition-all text-xs font-bold"
                                        >
                                          <Clock size={14} />
                                          إعادة للمراجعة
                                        </button>
                                      </>
                                    )}
                                    {approvalStatus === 'rejected' && (
                                      <>
                                        <button
                                          onClick={() => handleQuickApproveAll(provider.id)}
                                          className="inline-flex items-center gap-1.5 min-w-[88px] justify-center px-3 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 shadow-sm transition-all text-xs font-bold"
                                          title="قبول المزود وجميع خدماته دفعة واحدة"
                                        >
                                          <CheckCircle size={14} />
                                          قبول
                                        </button>
                                        <button
                                          onClick={() => handleStatusChange(provider.id, 'pending')}
                                          className="inline-flex items-center gap-1.5 min-w-[110px] justify-center px-3 py-2 bg-amber-500 text-white rounded-xl hover:bg-amber-600 shadow-sm transition-all text-xs font-bold"
                                        >
                                          <Clock size={14} />
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
          {/* Modal removed - moved to AddProvider.jsx */}

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

          {/* تأكيد الحذف النهائي */}
          {showDeleteProviderModal && selectedProvider && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
              <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-2">حذف المزود؟</h3>
                <p className="text-sm text-gray-600 mb-5">
                  {selectedProvider.fullName || selectedProvider.firstName || 'مزود'}{' '}
                  <span dir="ltr">({selectedProvider.phone})</span>
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={deletingProvider}
                    onClick={handlePermanentDeleteProvider}
                    className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 disabled:opacity-50"
                  >
                    {deletingProvider ? 'جاري الحذف...' : 'حذف نهائي'}
                  </button>
                  <button
                    type="button"
                    disabled={deletingProvider}
                    onClick={() => setShowDeleteProviderModal(false)}
                    className="flex-1 py-2.5 bg-gray-200 text-gray-800 rounded-xl font-semibold hover:bg-gray-300"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Provider Details Modal */}
          {selectedProvider && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 md:p-6">
              <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-auto">
                <div className="p-4 md:p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl md:text-2xl font-bold text-gray-800">تفاصيل المزود</h2>
                    <button
                      onClick={() => setSelectedProvider(null)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <XCircle size={24} />
                    </button>
                  </div>

                  {/* Tabs */}
                  <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
                    <button
                      onClick={() => setActiveTab('info')}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold transition-all ${activeTab === 'info' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      <Users size={18} />
                      <span>المعلومات</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('wallet')}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold transition-all ${activeTab === 'wallet' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      <Tag size={18} />
                      <span>المحفظة</span>
                      <span className="bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full text-xs">
                        {resolveProviderWalletBalance(selectedProvider, walletHistory).toFixed(1)}
                      </span>
                    </button>
                    <button
                      onClick={() => setActiveTab('orders')}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold transition-all ${activeTab === 'orders' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      <CheckCircle size={18} />
                      <span>الطلبات</span>
                      {orderStats && (
                        <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full text-xs">
                          {orderStats.total}
                        </span>
                      )}
                    </button>
                  </div>
                </div>
                <div className="p-4 md:p-6 space-y-6">
                  {activeTab === 'info' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                      {editProviderForm ? (
                        <form onSubmit={handleSaveEditProvider} className="bg-gray-50 rounded-2xl p-6 border border-gray-200 space-y-4">
                          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <Edit2 size={20} />
                            تعديل بيانات المزود
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-1">الاسم الأول</label>
                              <input
                                type="text"
                                value={editProviderForm.firstName}
                                onChange={(e) => setEditProviderForm(f => ({ ...f, firstName: e.target.value }))}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-1">الاسم الأخير</label>
                              <input
                                type="text"
                                value={editProviderForm.lastName}
                                onChange={(e) => setEditProviderForm(f => ({ ...f, lastName: e.target.value }))}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-1">رقم الهاتف</label>
                              <input
                                type="text"
                                value={editProviderForm.phone}
                                onChange={(e) => setEditProviderForm(f => ({ ...f, phone: e.target.value }))}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-1">البريد الإلكتروني</label>
                              <input
                                type="text"
                                value={editProviderForm.email || ''}
                                onChange={(e) => setEditProviderForm(f => ({ ...f, email: e.target.value || null }))}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                placeholder="اختياري"
                              />
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-sm font-semibold text-gray-700 mb-1">الجنسية</label>
                              <select
                                value={editProviderForm.nationality || ''}
                                onChange={(e) => setEditProviderForm(f => ({ ...f, nationality: e.target.value }))}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                              >
                                {NATIONALITIES.map((n) => (
                                  <option key={n.value} value={n.value}>{n.label}</option>
                                ))}
                              </select>
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-sm font-semibold text-gray-700 mb-1">المدينة</label>
                              <select
                                value={editProviderForm.city || ''}
                                onChange={(e) => setEditProviderForm(f => ({ ...f, city: e.target.value }))}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                              >
                                <option value="">اختر المدينة</option>
                                {SAUDI_CITIES.map((city) => (
                                  <option key={city.value} value={city.value}>
                                    {city.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="flex gap-2 pt-2">
                            <button
                              type="submit"
                              disabled={savingEdit}
                              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 font-semibold"
                            >
                              {savingEdit ? 'جاري الحفظ...' : 'حفظ'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditProviderForm(null)}
                              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold"
                            >
                              إلغاء
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <h3 className="font-semibold text-gray-700 mb-2">الاسم</h3>
                            <p className="text-gray-800 font-medium">
                              {selectedProvider.firstName} {selectedProvider.lastName}
                            </p>
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-700 mb-2">رقم الهاتف</h3>
                            <p className="text-gray-800 font-medium">{selectedProvider.phone}</p>
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-700 mb-2">البريد الإلكتروني</h3>
                            <p className="text-gray-800">{selectedProvider.email || 'لا يوجد'}</p>
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-700 mb-2">الجنسية</h3>
                            <p className="text-gray-800">{NATIONALITIES.find(n => n.value === selectedProvider.nationality)?.label || selectedProvider.nationality || 'غير محدد'}</p>
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-700 mb-2">المدينة</h3>
                            <p className="text-gray-800">{SAUDI_CITIES.find((c) => c.value === selectedProvider.city)?.label || selectedProvider.city || 'غير محددة'}</p>
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-700 mb-2">نوع المزود</h3>
                            <div className="flex items-center gap-3">
                              <span
                                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${getTypeBadge(selectedProvider.type).color}`}
                              >
                                {getTypeBadge(selectedProvider.type).text}
                              </span>
                              <button
                                onClick={() => toggleProviderType(selectedProvider.id)}
                                className="text-xs px-3 py-1 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                              >
                                تعديل إلى {selectedProvider.type === 'vip' ? 'عام' : 'VIP'}
                              </button>
                            </div>
                          </div>
                          <div className="md:col-span-2">
                            <button
                              onClick={() => setEditProviderForm({
                                firstName: selectedProvider.firstName || '',
                                lastName: selectedProvider.lastName || '',
                                phone: selectedProvider.phone || '',
                                email: selectedProvider.email || '',
                                nationality: selectedProvider.nationality || '',
                                city: selectedProvider.city || '',
                              })}
                              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-50 text-teal-700 rounded-lg hover:bg-teal-100 font-semibold"
                            >
                              <Edit2 size={18} />
                              تعديل البيانات
                            </button>
                          </div>
                        </div>
                      )}

                      <div>
                        <h3 className="font-semibold text-gray-700 mb-4">إدارة الخدمات</h3>
                        <div className="mb-4">
                          <button
                            onClick={handleApproveProviderAndAllServices}
                            disabled={approvingAll}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60 font-semibold"
                          >
                            <CheckCircle size={18} />
                            {approvingAll ? 'جاري القبول...' : 'قبول المزود والخدمات'}
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {mainServices.map((service) => {
                            const providerService =
                              selectedProvider.services?.[service.id] ||
                              selectedProvider.services?.[service.serviceId];
                            const isRequested = !!providerService;
                            const status =
                              typeof providerService === 'object'
                                ? providerService.status
                                : providerService === true
                                  ? 'approved'
                                  : 'pending';

                            return (
                              <div
                                key={service.id}
                                className="border border-gray-200 rounded-xl p-4 flex items-center justify-between"
                              >
                                <div>
                                  <p className="font-bold text-gray-800">{service.name}</p>
                                  {isRequested ? (
                                    <span
                                      className={`text-xs px-2 py-0.5 rounded-full ${status === 'approved'
                                          ? 'bg-green-100 text-green-700'
                                          : status === 'rejected'
                                            ? 'bg-red-100 text-red-700'
                                            : 'bg-yellow-100 text-yellow-700'
                                        }`}
                                    >
                                      {status === 'approved'
                                        ? '✅ مقبول'
                                        : status === 'rejected'
                                          ? '❌ مرفوض'
                                          : '⏳ قيد المراجعة'}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-gray-400 font-medium">غير مشترك</span>
                                  )}
                                </div>

                                {/* أزرار التحكم */}
                                {isRequested ? (
                                  <div className="flex items-center gap-1">
                                    {status !== 'approved' && (
                                      <button
                                        onClick={() => handleUpdateServiceStatus(service.id, 'approved')}
                                        className="p-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 disabled:opacity-50"
                                        disabled={updatingServiceId === `${service.id}:approved`}
                                        title="قبول"
                                      >
                                        <CheckCircle size={16} />
                                      </button>
                                    )}
                                    {status !== 'rejected' && (
                                      <button
                                        onClick={() => handleUpdateServiceStatus(service.id, 'rejected')}
                                        className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 disabled:opacity-50"
                                        disabled={updatingServiceId === `${service.id}:rejected`}
                                        title="رفض"
                                      >
                                        <XCircle size={16} />
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleRemoveService(service.id)}
                                      className="p-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                                      disabled={removingServiceId === service.id}
                                      title="حذف الخدمة من المزود"
                                    >
                                      {removingServiceId === service.id ? (
                                        <Clock size={16} className="animate-pulse" />
                                      ) : (
                                        <Trash2 size={16} />
                                      )}
                                    </button>
                                  </div>
                                ) : (
                                  // إذا لم يكن مشتركاً، زر لإضافة الخدمة مباشرة كمقبولة
                                  <button
                                    onClick={() => handleUpdateServiceStatus(service.id, 'approved')}
                                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 disabled:opacity-50"
                                    disabled={updatingServiceId === `${service.id}:approved`}
                                  >
                                    {updatingServiceId === `${service.id}:approved` ? 'جاري الإضافة...' : 'إضافة الخدمة للمزوّد'}
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Documents - صور أو PDF أو Word */}
                      <div>
                        <h3 className="font-semibold text-gray-700 mb-4">المستندات والصور</h3>
                        {selectedProvider.documents && (
                          <div className="flex flex-wrap gap-2 mb-4">
                            {resolveProfileDocuments(selectedProvider.documents).map((doc) => (
                              <span
                                key={doc.key}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                                  doc.status === 'verified'
                                    ? 'bg-green-50 text-green-700 border border-green-200'
                                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                                }`}
                              >
                                {doc.status === 'verified' ? <CheckCircle size={14} /> : <Clock size={14} />}
                                {doc.label}
                              </span>
                            ))}
                          </div>
                        )}
                        {selectedProvider.documents && listDocumentsForDisplay(selectedProvider.documents).length > 0 && (
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                            {listDocumentsForDisplay(selectedProvider.documents).map(({ key, url, type, label: docLabel }) => {
                              const isImage = type === 'image';
                              return (
                                <div key={`${key}-${url}`} className="relative group rounded-xl overflow-hidden border-2 border-gray-100 hover:border-teal-400 transition-all bg-gray-50">
                                  {isImage ? (
                                    <>
                                      <img src={url} alt={docLabel} className="w-full h-32 object-cover" />
                                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-all">
                                        <button onClick={() => window.open(url, '_blank')} className="p-2 bg-white rounded-full shadow-lg" title="عرض">
                                          <Eye size={18} className="text-gray-700" />
                                        </button>
                                        <button
                                          onClick={() => handleDeleteDocument(key)}
                                          disabled={deletingDocKey === key}
                                          className="p-2 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 disabled:opacity-50"
                                          title="حذف المستند"
                                        >
                                          {deletingDocKey === key ? <Clock size={18} className="animate-pulse" /> : <Trash2 size={18} />}
                                        </button>
                                      </div>
                                    </>
                                  ) : (
                                    <div className="relative flex flex-col items-center justify-center h-32 p-3 hover:bg-teal-50 transition-colors">
                                      <a href={url} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center flex-1">
                                        <FileText size={36} className="text-teal-600 mb-2" />
                                        <span className="text-xs font-semibold text-gray-600">{type === 'pdf' ? 'PDF' : 'Word'}</span>
                                        <span className="text-[10px] text-gray-500 mt-1">اضغط للتحميل/العرض</span>
                                      </a>
                                      <button
                                        onClick={() => handleDeleteDocument(key)}
                                        disabled={deletingDocKey === key}
                                        className="absolute top-1 left-1 p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
                                        title="حذف المستند"
                                      >
                                        {deletingDocKey === key ? <Clock size={14} className="animate-pulse" /> : <Trash2 size={14} />}
                                      </button>
                                    </div>
                                  )}
                                  <p className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] py-1 text-center truncate px-1">
                                    {docLabel}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
                          <h4 className="font-semibold text-teal-800 mb-3 flex items-center gap-2">
                            <Plus size={18} />
                            إضافة مستند أو صورة
                          </h4>
                          <form onSubmit={handleAddDocument} className="flex flex-col sm:flex-row gap-3 items-end">
                            <div className="flex-1 min-w-0">
                              <label className="block text-xs font-semibold text-gray-600 mb-1">نوع المستند</label>
                              <select
                                value={addDocType}
                                onChange={(e) => setAddDocType(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm"
                              >
                                {DOCUMENT_TYPE_OPTIONS.map((opt) => (
                                  <option key={opt.key} value={opt.key}>{opt.label}</option>
                                ))}
                              </select>
                            </div>
                            <div className="flex-1 min-w-0">
                              <label className="block text-xs font-semibold text-gray-600 mb-1">الملف (صورة أو PDF أو Word)</label>
                              <input
                                type="file"
                                accept="image/*,.pdf,.doc,.docx"
                                onChange={(e) => setAddDocFile(e.target.files?.[0] || null)}
                                className="w-full text-sm text-gray-600 file:mr-2 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-teal-100 file:text-teal-700 file:font-semibold"
                              />
                              {addDocFile && <span className="text-xs text-gray-500 mt-1 block truncate">{addDocFile.name}</span>}
                            </div>
                            <button
                              type="submit"
                              disabled={uploadingDocument || !addDocFile}
                              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 font-semibold whitespace-nowrap"
                            >
                              {uploadingDocument ? 'جاري الرفع...' : 'رفع'}
                            </button>
                          </form>
                        </div>
                      </div>

                      <div className="border-t border-gray-200 pt-6">
                        <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                          <ShieldBan size={20} className="text-amber-600" />
                          حظر من العملاء
                        </h3>
                        <p className="text-xs text-gray-500 mb-4">
                          عند رفض أو إلغاء المزود لطلب، يُحظر ساعة واحدة من نفس العميل ولا يستقبل طلباته الجديدة.
                        </p>
                        {loadingProviderBlocks ? (
                          <div className="flex items-center gap-2 text-gray-500 py-4">
                            <Loader2 size={18} className="animate-spin" />
                            <span className="text-sm">جاري التحميل...</span>
                          </div>
                        ) : providerBlocks.length === 0 ? (
                          <p className="text-sm text-gray-500 bg-gray-50 rounded-lg p-4">
                            لا يوجد حظر نشط أو منتهٍ مسجّل لهذا المزود.
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {providerBlocks.map((block) => {
                              const blockKey = `${block.customerId}:${block.providerId}`;
                              return (
                                <div
                                  key={blockKey}
                                  className={`rounded-xl border p-4 ${block.isActive ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-gray-50'}`}
                                >
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                      <p className="font-semibold text-gray-800 text-sm">
                                        {block.customerName || 'عميل'}
                                        {block.customerPhone && (
                                          <span className="text-gray-500 font-normal mr-2" dir="ltr">
                                            ({block.customerPhone})
                                          </span>
                                        )}
                                      </p>
                                      <p className="text-xs text-gray-500 mt-1">
                                        معرف العميل: <span className="font-mono">{block.customerId?.slice(-8)}</span>
                                      </p>
                                      <p className="text-xs text-gray-600 mt-2">
                                        السبب: {BLOCK_REASON_LABELS[block.reason] || block.reason || '—'}
                                      </p>
                                      {block.requestId && (
                                        <p className="text-xs text-gray-500">
                                          الطلب: <span className="font-mono">{block.requestId.slice(-8)}</span>
                                        </p>
                                      )}
                                      <p className="text-xs text-gray-600 mt-1">
                                        ينتهي: {formatBlockUntil(block)}
                                        {!block.isActive && (
                                          <span className="mr-2 text-gray-400">(منتهٍ)</span>
                                        )}
                                      </p>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                      <span
                                        className={`px-2 py-1 rounded-full text-xs font-semibold ${block.isActive ? 'bg-amber-200 text-amber-900' : 'bg-gray-200 text-gray-600'}`}
                                      >
                                        {block.isActive ? 'نشط' : 'منتهٍ'}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleUnblockProvider(block.customerId, block.providerId)}
                                        disabled={unblockingBlockKey === blockKey}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white text-xs font-semibold rounded-lg hover:bg-teal-700 disabled:opacity-50"
                                      >
                                        {unblockingBlockKey === blockKey ? (
                                          <Loader2 size={14} className="animate-spin" />
                                        ) : (
                                          <ShieldOff size={14} />
                                        )}
                                        رفع الحظر
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {isSuperAdmin && (
                        <div className="pt-4 border-t border-gray-200">
                          <button
                            type="button"
                            onClick={() => setShowDeleteProviderModal(true)}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold"
                          >
                            حذف نهائي
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'wallet' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                      {/* Stats Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-gradient-to-br from-teal-500 to-teal-600 p-5 rounded-2xl text-white shadow-lg">
                          <p className="text-teal-100 text-sm font-semibold mb-1">الرصيد الحالي</p>
                          <h4 className="text-3xl font-black">
                            {resolveProviderWalletBalance(selectedProvider, walletHistory).toFixed(2)} ر.س
                          </h4>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border-2 border-gray-100 shadow-sm">
                          <p className="text-gray-500 text-sm font-semibold mb-1">إجمالي الإيداعات</p>
                          <h4 className="text-2xl font-black text-green-600">
                            {walletHistory.filter(h => h.type === 'addition').reduce((sum, h) => sum + (h.amount || 0), 0).toFixed(1)} ر.س
                          </h4>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border-2 border-gray-100 shadow-sm">
                          <p className="text-gray-500 text-sm font-semibold mb-1">إجمالي الخصومات</p>
                          <h4 className="text-2xl font-black text-red-600">
                            {walletHistory.filter(h => h.type === 'deduction').reduce((sum, h) => sum + (h.amount || 0), 0).toFixed(1)} ر.س
                          </h4>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Adjustment Form */}
                        <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200">
                          <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <Edit2 size={18} className="text-teal-600" />
                            تعديل الرصيد يدوياً
                          </h4>
                          <form onSubmit={handleAdjustWallet} className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                              <button
                                type="button"
                                onClick={() => setWalletAdjustment({ ...walletAdjustment, type: 'addition' })}
                                className={`py-3 rounded-xl font-bold transition-all border-2 ${walletAdjustment.type === 'addition' ? 'bg-green-50 border-green-500 text-green-700' : 'bg-white border-gray-100 text-gray-500'}`}
                              >
                                إضافة (شحن)
                              </button>
                              <button
                                type="button"
                                onClick={() => setWalletAdjustment({ ...walletAdjustment, type: 'deduction' })}
                                className={`py-3 rounded-xl font-bold transition-all border-2 ${walletAdjustment.type === 'deduction' ? 'bg-red-50 border-red-500 text-red-700' : 'bg-white border-gray-100 text-gray-500'}`}
                              >
                                خصم
                              </button>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <button
                                type="button"
                                onClick={() => setWalletAdjustment({ ...walletAdjustment, type: 'compensation' })}
                                className={`py-3 rounded-xl font-bold transition-all border-2 ${walletAdjustment.type === 'compensation' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-gray-100 text-gray-500'}`}
                              >
                                تعويض
                              </button>
                              <input
                                type="number"
                                placeholder="المبلغ"
                                value={walletAdjustment.amount}
                                onChange={(e) => {
                                  setWalletAmountError('');
                                  setWalletAdjustment({ ...walletAdjustment, amount: e.target.value });
                                }}
                                className={`px-4 py-3 rounded-xl border-2 focus:outline-none font-bold ${walletAmountError
                                    ? 'border-red-400 focus:border-red-500'
                                    : 'border-gray-200 focus:border-teal-400'
                                  }`}
                              />
                            </div>
                            {walletAmountError && (
                              <p className="text-sm text-red-500 font-semibold">
                                {walletAmountError}
                              </p>
                            )}
                            <textarea
                              placeholder="سبب العملية (مثال: شحن عبر واتساب)"
                              value={walletAdjustment.reason}
                              onChange={(e) => setWalletAdjustment({ ...walletAdjustment, reason: e.target.value })}
                              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-teal-400 focus:outline-none min-h-[80px]"
                            ></textarea>
                            <button
                              disabled={isAdjustingWallet}
                              type="submit"
                              className="w-full py-4 bg-teal-600 text-white rounded-xl font-bold shadow-lg hover:bg-teal-700 disabled:opacity-50 transition-all"
                            >
                              {isAdjustingWallet ? 'جاري التنفيذ...' : 'تأكيد العملية'}
                            </button>
                          </form>
                        </div>

                        {/* History */}
                        <div className="space-y-4">
                          <h4 className="font-bold text-gray-800 flex items-center gap-2">
                            <Clock size={18} className="text-gray-500" />
                            سجل العمليات الأخير
                          </h4>
                          <div className="max-h-[300px] overflow-auto space-y-2 pr-2">
                            {loadingWallet ? (
                              <p className="text-center text-gray-400 py-4">جاري التحميل...</p>
                            ) : walletHistory.length === 0 ? (
                              <p className="text-center text-gray-400 py-4">لا توجد عمليات مسجلة</p>
                            ) : (
                              walletHistory.map((item) => (
                                <div key={item.id} className="bg-white p-3 rounded-xl border border-gray-100 flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${item.type === 'addition' ? 'bg-green-100 text-green-600' : item.type === 'deduction' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                                      {item.type === 'addition' ? '+' : item.type === 'deduction' ? '-' : '↺'}
                                    </div>
                                    <div>
                                      <p className="text-sm font-bold text-gray-800">{item.reason || 'عملية مجهولة'}</p>
                                      {(item.orderNumber != null && item.orderNumber !== '') ? (
                                        <p className="text-[10px] font-mono text-teal-600">رقم الطلب: #{String(item.orderNumber).padStart(9, '0')}</p>
                                      ) : (item.requestId ? (
                                        <p className="text-[10px] font-mono text-gray-400">الطلب: {item.requestId.slice(-8)}</p>
                                      ) : null)}
                                      <p className="text-[10px] text-gray-500">
                                        {item.timestamp ? format(item.timestamp.toDate ? item.timestamp.toDate() : new Date(item.timestamp), 'dd MMM yyyy, HH:mm', { locale: ar }) : '-'}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="text-left">
                                    <p className={`font-black ${item.type === 'addition' || item.type === 'compensation' ? 'text-green-600' : 'text-red-600'}`}>
                                      {item.type === 'deduction' ? '-' : '+'}{item.amount}
                                    </p>
                                    <p className="text-[9px] text-gray-400">الرصيد: {item.balance}</p>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'orders' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                      {(() => {
                        const CANCELLED_STATUSES = ['canceled_by_provider', 'canceled_by_provider_with_reason', 'canceled_by_client', 'canceled_by_client_with_reason', 'timed_out'];
                        const ACTIVE_STATUSES = ['searching', 'accepted', 'assigned', 'en_route', 'arrived', 'in_progress', 'pending_legal_docs', 'arriving', 'pending_client_confirmation', 'pending_review'];

                        const allOrders = orderStats?.orders || [];
                        const filteredOrders = ordersFilter === 'completed'
                          ? allOrders.filter(o => o.status === 'completed')
                          : ordersFilter === 'cancelled'
                            ? allOrders.filter(o => CANCELLED_STATUSES.includes(o.status))
                            : ordersFilter === 'active'
                              ? allOrders.filter(o => ACTIVE_STATUSES.includes(o.status))
                              : allOrders;

                        const badges = {
                          completed: { text: 'مكتمل', color: 'bg-green-100 text-green-700' },
                          pending_client_confirmation: { text: 'بانتظار تأكيد العميل', color: 'bg-yellow-100 text-yellow-700' },
                          pending_review: { text: 'قيد المراجعة', color: 'bg-amber-100 text-amber-700' },
                          searching: { text: 'جاري البحث', color: 'bg-blue-100 text-blue-700' },
                          assigned: { text: 'مقبول', color: 'bg-teal-100 text-teal-700' },
                          en_route: { text: 'في الطريق', color: 'bg-blue-100 text-blue-700' },
                          arrived: { text: 'وصل', color: 'bg-purple-100 text-purple-700' },
                          in_progress: { text: 'قيد التنفيذ', color: 'bg-orange-100 text-orange-700' },
                          pending_legal_docs: { text: 'بانتظار السند', color: 'bg-orange-100 text-orange-700' },
                          canceled_by_client: { text: 'ملغي من العميل', color: 'bg-red-100 text-red-700' },
                          canceled_by_provider: { text: 'ملغي من المزود', color: 'bg-red-100 text-red-700' },
                          canceled_by_client_with_reason: { text: 'ملغي', color: 'bg-red-100 text-red-700' },
                          canceled_by_provider_with_reason: { text: 'ملغي', color: 'bg-red-100 text-red-700' },
                          timed_out: { text: 'انتهت المهلة', color: 'bg-purple-100 text-purple-700' },
                        };

                        return (
                          <>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <button
                                type="button"
                                onClick={() => setOrdersFilter(ordersFilter === 'all' ? 'all' : 'all')}
                                className={`p-5 rounded-2xl text-right transition-all border-2 ${ordersFilter === 'all' ? 'border-blue-400 ring-2 ring-blue-200 bg-blue-50' : 'border-blue-100 bg-blue-50 hover:border-blue-300'}`}
                              >
                                <p className="text-blue-600 text-xs font-bold mb-1">إجمالي الطلبات</p>
                                <h4 className="text-2xl font-black text-blue-700">{orderStats?.total || 0}</h4>
                              </button>
                              <button
                                type="button"
                                onClick={() => setOrdersFilter(ordersFilter === 'completed' ? 'all' : 'completed')}
                                className={`p-5 rounded-2xl text-right transition-all border-2 ${ordersFilter === 'completed' ? 'border-green-400 ring-2 ring-green-200 bg-green-50' : 'border-green-100 bg-green-50 hover:border-green-300'}`}
                              >
                                <p className="text-green-600 text-xs font-bold mb-1">مكتملة</p>
                                <h4 className="text-2xl font-black text-green-700">{orderStats?.completed || 0}</h4>
                              </button>
                              <button
                                type="button"
                                onClick={() => setOrdersFilter(ordersFilter === 'cancelled' ? 'all' : 'cancelled')}
                                className={`p-5 rounded-2xl text-right transition-all border-2 ${ordersFilter === 'cancelled' ? 'border-red-400 ring-2 ring-red-200 bg-red-50' : 'border-red-100 bg-red-50 hover:border-red-300'}`}
                              >
                                <p className="text-red-600 text-xs font-bold mb-1">ملغاة</p>
                                <h4 className="text-2xl font-black text-red-700">{orderStats?.cancelled || 0}</h4>
                              </button>
                              <button
                                type="button"
                                onClick={() => setOrdersFilter(ordersFilter === 'active' ? 'all' : 'active')}
                                className={`p-5 rounded-2xl text-right transition-all border-2 ${ordersFilter === 'active' ? 'border-purple-400 ring-2 ring-purple-200 bg-purple-50' : 'border-purple-100 bg-purple-50 hover:border-purple-300'}`}
                              >
                                <p className="text-purple-600 text-xs font-bold mb-1">نسبة الإنجاز</p>
                                <h4 className="text-2xl font-black text-purple-700">
                                  {orderStats?.total ? Math.round((orderStats.completed / orderStats.total) * 100) : 0}%
                                </h4>
                              </button>
                            </div>

                            <div>
                              <h4 className="font-bold text-gray-800 mb-4 flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                  <Clock size={18} className="text-gray-500" />
                                  {ordersFilter === 'all' ? 'كل الطلبات' : ordersFilter === 'completed' ? 'الطلبات المكتملة' : ordersFilter === 'cancelled' ? 'الطلبات الملغاة' : 'نسبة الإنجاز'}
                                </span>
                                <span className="text-sm font-normal text-gray-400">({filteredOrders.length})</span>
                              </h4>
                              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                                <table className="w-full text-sm">
                                  <thead className="bg-gray-50">
                                    <tr>
                                      <th className="px-4 py-3 text-right">رقم الطلب</th>
                                      <th className="px-4 py-3 text-right">الخدمة</th>
                                      <th className="px-4 py-3 text-right">التاريخ</th>
                                      <th className="px-4 py-3 text-right">الحالة</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {loadingStats ? (
                                      <tr><td colSpan="4" className="text-center py-8 text-gray-400">جاري التحميل...</td></tr>
                                    ) : filteredOrders.length === 0 ? (
                                      <tr><td colSpan="4" className="text-center py-8 text-gray-400">لا توجد طلبات مسجلة</td></tr>
                                    ) : (
                                      filteredOrders.map((order) => {
                                        const badge = badges[order.status] || { text: order.status, color: 'bg-gray-100 text-gray-700' };
                                        return (
                                          <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-3 font-mono text-gray-500">{order.orderNumber != null ? `#${String(order.orderNumber).padStart(9, '0')}` : '—'}</td>
                                            <td className="px-4 py-3 font-bold text-gray-800">{order.serviceName || order.serviceType || '-'}</td>
                                            <td className="px-4 py-3 text-gray-600">
                                              {order.createdAt ? format(order.createdAt.toDate ? order.createdAt.toDate() : new Date(order.createdAt?.seconds ? order.createdAt.seconds * 1000 : order.createdAt), 'dd/MM/yyyy HH:mm', { locale: ar }) : '-'}
                                            </td>
                                            <td className="px-4 py-3">
                                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${badge.color}`}>
                                                {badge.text}
                                              </span>
                                            </td>
                                          </tr>
                                        );
                                      })
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
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
