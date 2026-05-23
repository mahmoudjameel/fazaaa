/**
 * منطق تشخيص التوزيع — مطابق لـ functions/index.js (performStagedSearch)
 * للاستخدام في لوحة التحكم فقط (فحص يدوي).
 */

export const MIN_BALANCE_FOR_REQUEST = 5;

export const DEFAULT_SEARCH_STAGES = [
  { maxRadius: 4, waitTime: 60, maxProviders: 3, vipOnly: false },
  { maxRadius: 7, waitTime: 20, maxProviders: 3, vipOnly: false },
  { maxRadius: 10, waitTime: 20, maxProviders: 3, vipOnly: false },
  { maxRadius: 13, waitTime: 20, maxProviders: 3, vipOnly: false },
  { maxRadius: 16, waitTime: 20, maxProviders: 3, vipOnly: false },
  { maxRadius: 19, waitTime: 20, maxProviders: 3, vipOnly: false },
  { maxRadius: 22, waitTime: 20, maxProviders: 3, vipOnly: false },
  { maxRadius: 25, waitTime: 20, maxProviders: 3, vipOnly: false },
];

export function calcDistanceKm(lat1, lon1, lat2, lon2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getProviderCoords(data) {
  const sources = [data?.location, data?.locationCoordinates, data?.coordinates].filter(Boolean);
  for (const loc of sources) {
    const lat = loc.latitude ?? loc.lat;
    const lng = loc.longitude ?? loc.lng;
    if (typeof lat === 'number' && typeof lng === 'number' && !Number.isNaN(lat) && !Number.isNaN(lng)) {
      return { latitude: lat, longitude: lng };
    }
  }
  return null;
}

export function timestampToMs(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value.seconds) return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export function resolveDistributionSettings(settingsDoc) {
  const sData = settingsDoc || {};
  let stagesToUse = DEFAULT_SEARCH_STAGES;
  let maxPerStage = 3;
  let vipEnabled = false;
  if (Array.isArray(sData.searchStages) && sData.searchStages.length > 0) {
    stagesToUse = sData.searchStages;
  }
  if (typeof sData.maxProvidersPerStage === 'number' && sData.maxProvidersPerStage > 0) {
    maxPerStage = sData.maxProvidersPerStage;
  }
  if (typeof sData.vipEnabled === 'boolean') {
    vipEnabled = sData.vipEnabled;
  }
  const maxDispatchRadiusKm = Math.max(...stagesToUse.map((s) => s.maxRadius ?? 15));
  return { stagesToUse, maxPerStage, vipEnabled, maxDispatchRadiusKm };
}

export function buildServiceMatcher(request) {
  const serviceCategory = request.serviceCategory || request.serviceName || '';
  const serviceId = request.serviceId || '';
  const parentServiceId = request.parentServiceId || '';
  const serviceIdLower = String(serviceId).toLowerCase();
  const categoryLower = String(serviceCategory).toLowerCase();
  const parentIdLower = String(parentServiceId).toLowerCase();

  const checkServiceMatch = (providerServiceId) => {
    const psIdLower = String(providerServiceId).toLowerCase();
    if (!psIdLower) return false;
    if (
      parentIdLower &&
      (psIdLower === parentIdLower ||
        psIdLower.includes(parentIdLower) ||
        parentIdLower.includes(psIdLower))
    ) {
      return true;
    }
    if (psIdLower === serviceIdLower || psIdLower === categoryLower) return true;
    if (serviceIdLower.startsWith('sub-')) {
      const withoutSub = serviceIdLower.replace(/^sub-/, '');
      const parentFromSub = withoutSub.split('-')[0];
      if (
        parentFromSub &&
        (psIdLower === parentFromSub ||
          psIdLower.includes(parentFromSub) ||
          parentFromSub.includes(psIdLower))
      ) {
        return true;
      }
      if (withoutSub && (psIdLower.includes(withoutSub) || withoutSub.includes(psIdLower))) return true;
    }
    if (serviceIdLower && (serviceIdLower.startsWith(psIdLower) || psIdLower.startsWith(serviceIdLower))) {
      return true;
    }
    if (
      categoryLower &&
      categoryLower.length > 2 &&
      (psIdLower.includes(categoryLower) || categoryLower.includes(psIdLower))
    ) {
      return true;
    }
    return false;
  };

  const listApprovedServiceKeys = (providerServices) => {
    const keys = [];
    if (Array.isArray(providerServices)) {
      providerServices.forEach((s) => {
        const id = typeof s === 'string' ? s : s?.id || s?.serviceId;
        if (id) keys.push(String(id));
      });
      return keys;
    }
    if (providerServices && typeof providerServices === 'object') {
      Object.entries(providerServices).forEach(([sId, sVal]) => {
        const isApproved = sVal === true || sVal?.status === 'approved' || sVal?.approved === true;
        if (isApproved) keys.push(String(sId));
      });
    }
    return keys;
  };

  const getMatchingServiceKeys = (providerServices) =>
    listApprovedServiceKeys(providerServices).filter((k) => checkServiceMatch(k));

  return { checkServiceMatch, listApprovedServiceKeys, getMatchingServiceKeys, serviceId, serviceCategory, parentServiceId };
}

export function getRequestCustomerCoords(request) {
  const coords = request.coordinates || request.address;
  const custLat = coords?.latitude ?? coords?.lat;
  const custLng = coords?.longitude ?? coords?.lng;
  if (custLat == null || custLng == null || Number.isNaN(Number(custLat)) || Number.isNaN(Number(custLng))) {
    return null;
  }
  return { latitude: Number(custLat), longitude: Number(custLng) };
}

/**
 * فحص مزود واحد مقابل طلب — يُرجع أسباب الاستبعاد أو القبول
 */
export function evaluateProviderEligibility(providerId, providerData, request, distributionSettings, nowMs = Date.now()) {
  const checks = [];
  const { maxDispatchRadiusKm } = resolveDistributionSettings(distributionSettings);
  const rejectedProviders = request.rejectedProviders || [];
  const matcher = buildServiceMatcher(request);
  const customerCoords = getRequestCustomerCoords(request);

  const fail = (id, label, detail) => {
    checks.push({ id, status: 'fail', label, detail });
    return false;
  };
  const pass = (id, label, detail) => {
    checks.push({ id, status: 'pass', label, detail });
    return true;
  };
  const warn = (id, label, detail) => {
    checks.push({ id, status: 'warn', label, detail });
  };

  if (!customerCoords) {
    fail('request_coords', 'إحداثيات الطلب', 'الطلب بدون coordinates صالحة — البحث لا يبدأ في السيرفر');
    return { eligible: false, checks, metrics: null };
  }
  pass('request_coords', 'إحداثيات الطلب', `${customerCoords.latitude.toFixed(5)}, ${customerCoords.longitude.toFixed(5)}`);

  if (request.status !== 'searching') {
    warn('request_status', 'حالة الطلب', `الحالة الحالية: ${request.status} (التشخيص يفترض searching للتوزيع)`);
  } else {
    pass('request_status', 'حالة الطلب', 'searching');
  }

  const notified = Array.isArray(request.notifiedProviders) ? request.notifiedProviders : [];
  if (notified.includes(providerId)) {
    pass('already_notified', 'تم إشعاره سابقاً', `موجود في notifiedProviders (${notified.length} مزود)`);
  }

  if (rejectedProviders.includes(providerId)) {
    fail('rejected', 'رفض الطلب', 'المزود في rejectedProviders');
    return { eligible: false, checks, metrics: null };
  }

  if (providerData.isOnline !== true) {
    fail('is_online', 'متصل (isOnline)', `القيمة: ${String(providerData.isOnline)} — يجب true`);
    return { eligible: false, checks, metrics: null };
  }
  pass('is_online', 'متصل (isOnline)', 'true');

  const approvalStatus =
    providerData.approvalStatus ||
    (['pending', 'approved', 'rejected'].includes(providerData.status) ? providerData.status : null);
  if (approvalStatus !== 'approved' || providerData.isActive === false) {
    fail(
      'approval',
      'اعتماد الحساب',
      `approvalStatus=${approvalStatus || '—'}, isActive=${providerData.isActive !== false}`
    );
    return { eligible: false, checks, metrics: null };
  }
  pass('approval', 'اعتماد الحساب', 'approved ونشط');

  const balance = providerData.wallet?.balance ?? 0;
  if (balance < MIN_BALANCE_FOR_REQUEST) {
    fail('wallet', 'رصيد المحفظة', `${balance} ر.س — الحد الأدنى ${MIN_BALANCE_FOR_REQUEST} ر.س في السيرفر`);
    return { eligible: false, checks, metrics: null };
  }
  pass('wallet', 'رصيد المحفظة', `${balance} ر.س`);

  if (providerData.isBusy === true || providerData.activeRequestId) {
    fail(
      'busy',
      'غير مشغول',
      `isBusy=${providerData.isBusy}, activeRequestId=${providerData.activeRequestId || '—'}`
    );
    return { eligible: false, checks, metrics: null };
  }
  pass('busy', 'غير مشغول', 'لا طلب نشط');

  const locationFreshMs = timestampToMs(providerData.lastHeartbeat) || timestampToMs(providerData.locationUpdatedAt);
  const locationAgeMs = locationFreshMs > 0 ? nowMs - locationFreshMs : Infinity;
  const locationAgeMin = locationAgeMs / 60000;

  if (locationFreshMs <= 0) {
    warn('location_age', 'آخر تحديث موقع', 'لا lastHeartbeat ولا locationUpdatedAt — عقوبة ترتيب +3 كم');
  } else if (locationAgeMin > 15) {
    warn('location_age', 'آخر تحديث موقع', `منذ ${locationAgeMin.toFixed(1)} دقيقة — قد يؤثر على الترتيب (لا يُستبعد في الكود الحالي)`);
  } else {
    pass('location_age', 'آخر تحديث موقع', `منذ ${locationAgeMin.toFixed(1)} دقيقة`);
  }

  const pCoords = getProviderCoords(providerData);
  if (!pCoords) {
    fail('provider_location', 'موقع المزود في Firestore', 'location / locationCoordinates فارغ — يُستبعد من السيرفر');
    return { eligible: false, checks, metrics: null };
  }
  pass(
    'provider_location',
    'موقع المزود في Firestore',
    `${pCoords.latitude.toFixed(5)}, ${pCoords.longitude.toFixed(5)}`
  );

  const providerServices = providerData.services || {};
  const matchingKeys = matcher.getMatchingServiceKeys(providerServices);
  const approvedKeys = matcher.listApprovedServiceKeys(providerServices);

  if (matchingKeys.length === 0) {
    fail(
      'service_match',
      'تطابق الخدمة',
      `طلب: serviceId="${matcher.serviceId}" parent="${matcher.parentServiceId || '—'}" category="${matcher.serviceCategory}" | معتمدة عند المزود: [${approvedKeys.join(', ') || 'لا شيء'}]`
    );
    return { eligible: false, checks, metrics: null };
  }
  pass('service_match', 'تطابق الخدمة', `مطابق: [${matchingKeys.join(', ')}]`);

  const dist = calcDistanceKm(
    customerCoords.latitude,
    customerCoords.longitude,
    pCoords.latitude,
    pCoords.longitude
  );

  if (dist > maxDispatchRadiusKm) {
    fail(
      'distance_max',
      'ضمن نطاق البحث الكلي',
      `${dist.toFixed(2)} كم > الحد ${maxDispatchRadiusKm} كم`
    );
    return { eligible: false, checks, metrics: null };
  }
  pass('distance_max', 'ضمن نطاق البحث الكلي', `${dist.toFixed(2)} كم (حد ${maxDispatchRadiusKm} كم)`);

  const freshnessPenalty =
    locationAgeMin <= 2 ? 0.0 : locationAgeMin <= 5 ? 0.5 : locationAgeMin <= 10 ? 1.5 : 3.0;
  const sortScore = dist + freshnessPenalty;
  const isVIP = providerData.type === 'vip' || providerData.isVIP === true;

  return {
    eligible: true,
    checks,
    metrics: {
      distanceKm: dist,
      locationAgeMin: locationFreshMs > 0 ? Math.round(locationAgeMin * 10) / 10 : null,
      freshnessPenalty,
      sortScore,
      isVIP,
      matchingServiceKeys: matchingKeys,
    },
  };
}

/**
 * محاكاة من سيتم إشعاره في كل مرحلة (نفس منطق performStagedSearch)
 */
export function simulateDispatchStages(eligibleProviders, distributionSettings) {
  const { stagesToUse, maxPerStage, vipEnabled } = resolveDistributionSettings(distributionSettings);
  const globalNotified = new Set();
  const stageResults = [];
  const providerStageMap = {};

  for (let i = 0; i < stagesToUse.length; i++) {
    const range = stagesToUse[i];
    const maxR = range.maxRadius ?? 15;
    const stageTarget = range.maxProviders ?? maxPerStage;
    const isVipStage = range.vipOnly === true && vipEnabled;

    const stageCandidates = eligibleProviders.filter((p) => {
      if (p.distance > maxR) return false;
      if (globalNotified.has(p.id)) return false;
      if (isVipStage && !p.isVIP) return false;
      return true;
    });

    const notifiedThisStage = [];
    const count = Math.min(stageTarget, stageCandidates.length);
    for (let k = 0; k < count; k++) {
      const p = stageCandidates[k];
      globalNotified.add(p.id);
      notifiedThisStage.push(p);
      providerStageMap[p.id] = {
        stage: i + 1,
        maxRadius: maxR,
        rankInStage: k + 1,
        sortScore: p.sortScore,
      };
    }

    stageResults.push({
      stage: i + 1,
      maxRadius: maxR,
      waitTime: range.waitTime ?? 20,
      vipOnly: isVipStage,
      targetCount: stageTarget,
      candidateCount: stageCandidates.length,
      notified: notifiedThisStage,
    });
  }

  return { stageResults, providerStageMap, totalNotified: globalNotified.size };
}

/**
 * بناء قائمة المؤهلين من كل المزودين المتصلين (مثل fetchEligibleProviders)
 */
export function buildEligibleProvidersList(onlineProviders, request, distributionSettings, nowMs = Date.now()) {
  const { maxDispatchRadiusKm } = resolveDistributionSettings(distributionSettings);
  const customerCoords = getRequestCustomerCoords(request);
  if (!customerCoords) return [];

  const rejectedProviders = request.rejectedProviders || [];
  const matcher = buildServiceMatcher(request);
  const eligible = [];

  onlineProviders.forEach(({ id, data }) => {
    const evalResult = evaluateProviderEligibility(id, data, request, distributionSettings, nowMs);
    if (!evalResult.eligible || !evalResult.metrics) return;
    if (rejectedProviders.includes(id)) return;
    eligible.push({
      id,
      name: data.fullName || data.name || `${data.firstName || ''} ${data.lastName || ''}`.trim() || id.slice(-8),
      phone: data.phone,
      distance: evalResult.metrics.distanceKm,
      distanceKm: evalResult.metrics.distanceKm,
      locationAgeMin: evalResult.metrics.locationAgeMin,
      freshnessPenalty: evalResult.metrics.freshnessPenalty,
      sortScore: evalResult.metrics.sortScore,
      isVIP: evalResult.metrics.isVIP,
    });
  });

  eligible.sort((a, b) => a.sortScore - b.sortScore);
  return eligible.filter((p) => p.distanceKm <= maxDispatchRadiusKm);
}

export function diagnoseProviderForRequest(providerId, providerData, request, allOnlineProviders, distributionSettings) {
  const evaluation = evaluateProviderEligibility(providerId, providerData, request, distributionSettings);
  const eligibleAll = buildEligibleProvidersList(allOnlineProviders, request, distributionSettings);
  const rankIndex = eligibleAll.findIndex((p) => p.id === providerId);
  const simulation = simulateDispatchStages(eligibleAll, distributionSettings);
  const stageInfo = simulation.providerStageMap[providerId] || null;
  const notified = Array.isArray(request.notifiedProviders) ? request.notifiedProviders : [];

  let notifyVerdict = '';
  if (!evaluation.eligible) {
    notifyVerdict = 'غير مؤهل — لن يُشعَر';
  } else if (notified.includes(providerId)) {
    notifyVerdict = stageInfo
      ? `تم إشعاره (محاكاة: المرحلة ${stageInfo.stage}، ترتيب ${stageInfo.rankInStage} ضمن ${stageInfo.maxRadius} كم)`
      : 'موجود في notifiedProviders لكن خارج محاكاة المراحل الحالية (ربما إعدادات تغيّرت)';
  } else if (stageInfo) {
    notifyVerdict = `مؤهل — يُفترض إشعاره في المرحلة ${stageInfo.stage} (ترتيب ${stageInfo.rankInStage})`;
  } else if (rankIndex >= 0) {
    notifyVerdict = `مؤهل (ترتيب ${rankIndex + 1} من ${eligibleAll.length}) لكن ليس ضمن أول ${distributionSettings?.searchStages?.[0]?.maxProviders ?? 3} في المرحلة 1 — انتظر مراحل لاحقة`;
    const stage1 = simulation.stageResults[0];
    if (stage1 && rankIndex >= stage1.targetCount) {
      notifyVerdict = `مؤهل — ترتيبه ${rankIndex + 1}؛ المرحلة 1 تشعر فقط أول ${stage1.targetCount} ضمن ${stage1.maxRadius} كم`;
    }
  } else {
    notifyVerdict = 'غير مؤهل أو خارج القائمة';
  }

  return {
    evaluation,
    eligibleAll,
    simulation,
    rankIndex: rankIndex >= 0 ? rankIndex + 1 : null,
    totalEligible: eligibleAll.length,
    notifyVerdict,
    wasNotified: notified.includes(providerId),
  };
}
