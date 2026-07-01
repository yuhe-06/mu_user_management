const state = {
  token: localStorage.getItem("mu_user_management_token") || "",
  activeView: "platform",
  monitorStartDate: localStorage.getItem("mu_user_management_monitor_start_date") || "",
  monitorEndDate: localStorage.getItem("mu_user_management_monitor_end_date") || "",
  platformStartDate: localStorage.getItem("mu_user_management_platform_start_date") || "",
  platformEndDate: localStorage.getItem("mu_user_management_platform_end_date") || "",
  agentStartDate: localStorage.getItem("mu_user_management_agent_start_date") || "",
  agentEndDate: localStorage.getItem("mu_user_management_agent_end_date") || "",
  monitorAudience: localStorage.getItem("mu_user_management_monitor_audience") || "all",
  platformAudience: localStorage.getItem("mu_user_management_platform_audience") || "all",
  agentAudience: localStorage.getItem("mu_user_management_agent_audience") || "all",
  page: 1,
  pageSize: 20,
  total: 0,
  filters: {},
  users: [],
  monitorDashboard: null,
  platformDashboard: null,
  agentDashboard: null,
  agentUserPage: 1,
  agentSessionPage: 1,
  agentStickyUserPage: 1,
  agentTablePageSize: 10,
  agentStickyUserPageSize: 5,
  monitorOrganizationPage: 1,
  monitorEndpointPage: 1,
  monitorUserPage: 1,
  monitorTablePageSize: 10,
  pendingEmail: null,
  batchUsers: [],
};

const els = {
  loginView: document.querySelector("#loginView"),
  adminView: document.querySelector("#adminView"),
  loginForm: document.querySelector("#loginForm"),
  loginError: document.querySelector("#loginError"),
  adminName: document.querySelector("#adminName"),
  pageTitle: document.querySelector("#pageTitle"),
  pageSubtitle: document.querySelector("#pageSubtitle"),
  monitorNav: document.querySelector("#monitorNav"),
  platformNav: document.querySelector("#platformNav"),
  agentNav: document.querySelector("#agentNav"),
  managementNav: document.querySelector("#managementNav"),
  monitorView: document.querySelector("#monitorView"),
  platformView: document.querySelector("#platformView"),
  agentView: document.querySelector("#agentView"),
  managementView: document.querySelector("#managementView"),
  monitorGranularityHint: document.querySelector("#monitorGranularityHint"),
  monitorRangeForm: document.querySelector("#monitorRangeForm"),
  monitorStartDate: document.querySelector("#monitorStartDate"),
  monitorEndDate: document.querySelector("#monitorEndDate"),
  monitorAudience: document.querySelector("#monitorAudience"),
  platformGranularityHint: document.querySelector("#platformGranularityHint"),
  platformRangeForm: document.querySelector("#platformRangeForm"),
  platformStartDate: document.querySelector("#platformStartDate"),
  platformEndDate: document.querySelector("#platformEndDate"),
  platformAudience: document.querySelector("#platformAudience"),
  agentGranularityHint: document.querySelector("#agentGranularityHint"),
  agentRangeForm: document.querySelector("#agentRangeForm"),
  agentStartDate: document.querySelector("#agentStartDate"),
  agentEndDate: document.querySelector("#agentEndDate"),
  agentAudience: document.querySelector("#agentAudience"),
  resetMonitorRange: document.querySelector("#resetMonitorRange"),
  resetPlatformRange: document.querySelector("#resetPlatformRange"),
  resetAgentRange: document.querySelector("#resetAgentRange"),
  topbarActions: document.querySelector("#topbarActions"),
  sendReportButton: document.querySelector("#sendReportButton"),
  logoutButton: document.querySelector("#logoutButton"),
  filterForm: document.querySelector("#filterForm"),
  overviewCards: document.querySelector("#overviewCards"),
  platformOverviewCards: document.querySelector("#platformOverviewCards"),
  platformAiAnalysis: document.querySelector("#platformAiAnalysis"),
  featureUsageCards: document.querySelector("#featureUsageCards"),
  featureUsageBody: document.querySelector("#featureUsageBody"),
  featureTrendGrid: document.querySelector("#featureTrendGrid"),
  featureTrendDialog: document.querySelector("#featureTrendDialog"),
  featureTrendDialogTitle: document.querySelector("#featureTrendDialogTitle"),
  featureTrendDialogLegend: document.querySelector("#featureTrendDialogLegend"),
  featureTrendDialogChart: document.querySelector("#featureTrendDialogChart"),
  closeFeatureTrendDialog: document.querySelector("#closeFeatureTrendDialog"),
  agentUsageCards: document.querySelector("#agentUsageCards"),
  agentRetentionCards: document.querySelector("#agentRetentionCards"),
  agentUsageBody: document.querySelector("#agentUsageBody"),
  agentUserListBody: document.querySelector("#agentUserListBody"),
  agentUserPageInfo: document.querySelector("#agentUserPageInfo"),
  agentUserPrev: document.querySelector("#agentUserPrev"),
  agentUserNext: document.querySelector("#agentUserNext"),
  agentSessionPageInfo: document.querySelector("#agentSessionPageInfo"),
  agentSessionPrev: document.querySelector("#agentSessionPrev"),
  agentSessionNext: document.querySelector("#agentSessionNext"),
  agentStickinessDistributionBody: document.querySelector("#agentStickinessDistributionBody"),
  agentStickyUserBody: document.querySelector("#agentStickyUserBody"),
  agentStickyUserPageInfo: document.querySelector("#agentStickyUserPageInfo"),
  agentStickyUserPrev: document.querySelector("#agentStickyUserPrev"),
  agentStickyUserNext: document.querySelector("#agentStickyUserNext"),
  agentRetentionAnalysis: document.querySelector("#agentRetentionAnalysis"),
  agentUserDistribution: document.querySelector("#agentUserDistribution"),
  agentOrganizationDistribution: document.querySelector("#agentOrganizationDistribution"),
  platformTrendLegend: document.querySelector("#platformTrendLegend"),
  platformTrendChart: document.querySelector("#platformTrendChart"),
  agentTrendLegend: document.querySelector("#agentTrendLegend"),
  agentTrendChart: document.querySelector("#agentTrendChart"),
  combinedTrendLegend: document.querySelector("#combinedTrendLegend"),
  combinedTrendChart: document.querySelector("#combinedTrendChart"),
  roleDistribution: document.querySelector("#roleDistribution"),
  organizationDistribution: document.querySelector("#organizationDistribution"),
  topEndpointsBody: document.querySelector("#topEndpointsBody"),
  topUsersBody: document.querySelector("#topUsersBody"),
  monitorEndpointPageInfo: document.querySelector("#monitorEndpointPageInfo"),
  monitorEndpointPrev: document.querySelector("#monitorEndpointPrev"),
  monitorEndpointNext: document.querySelector("#monitorEndpointNext"),
  monitorUserPageInfo: document.querySelector("#monitorUserPageInfo"),
  monitorUserPrev: document.querySelector("#monitorUserPrev"),
  monitorUserNext: document.querySelector("#monitorUserNext"),
  batchCreateButton: document.querySelector("#batchCreateButton"),
  createButton: document.querySelector("#createButton"),
  userTableBody: document.querySelector("#userTableBody"),
  userTableHeader: document.querySelector("#userTableHeader"),
  columnButton: document.querySelector("#columnButton"),
  columnMenu: document.querySelector("#columnMenu"),
  resultSummary: document.querySelector("#resultSummary"),
  pageInfo: document.querySelector("#pageInfo"),
  prevPage: document.querySelector("#prevPage"),
  nextPage: document.querySelector("#nextPage"),
  emptyState: document.querySelector("#emptyState"),
  userDialog: document.querySelector("#userDialog"),
  userForm: document.querySelector("#userForm"),
  dialogTitle: document.querySelector("#dialogTitle"),
  closeDialog: document.querySelector("#closeDialog"),
  cancelDialog: document.querySelector("#cancelDialog"),
  formError: document.querySelector("#formError"),
  batchDialog: document.querySelector("#batchDialog"),
  batchForm: document.querySelector("#batchForm"),
  closeBatchDialog: document.querySelector("#closeBatchDialog"),
  cancelBatchDialog: document.querySelector("#cancelBatchDialog"),
  previewBatchButton: document.querySelector("#previewBatchButton"),
  confirmBatchButton: document.querySelector("#confirmBatchButton"),
  batchError: document.querySelector("#batchError"),
  batchPreviewSection: document.querySelector("#batchPreviewSection"),
  batchPreviewSummary: document.querySelector("#batchPreviewSummary"),
  batchPreviewBody: document.querySelector("#batchPreviewBody"),
  batchResultSection: document.querySelector("#batchResultSection"),
  batchResultSummary: document.querySelector("#batchResultSummary"),
  batchFailureSummary: document.querySelector("#batchFailureSummary"),
  batchFailureWrap: document.querySelector("#batchFailureWrap"),
  batchFailureBody: document.querySelector("#batchFailureBody"),
  mailDialog: document.querySelector("#mailDialog"),
  mailUserLabel: document.querySelector("#mailUserLabel"),
  mailPassword: document.querySelector("#mailPassword"),
  mailError: document.querySelector("#mailError"),
  closeMailDialog: document.querySelector("#closeMailDialog"),
  cancelMailDialog: document.querySelector("#cancelMailDialog"),
  copyMailPassword: document.querySelector("#copyMailPassword"),
  confirmMailDialog: document.querySelector("#confirmMailDialog"),
  reportDialog: document.querySelector("#reportDialog"),
  closeReportDialog: document.querySelector("#closeReportDialog"),
  cancelReportDialog: document.querySelector("#cancelReportDialog"),
  confirmReportDialog: document.querySelector("#confirmReportDialog"),
  reportRecipients: document.querySelector("#reportRecipients"),
  reportError: document.querySelector("#reportError"),
  toast: document.querySelector("#toast"),
};

const nullableFields = new Set([
  "edu_email",
  "organization_name",
  "permissions",
  "permissions_new",
  "teams_email_reg",
  "created_at",
  "updated_at",
  "subscribe_start_at",
  "subscribe_end_at",
]);

const dateTimeFields = new Set(["created_at", "updated_at", "subscribe_start_at", "subscribe_end_at"]);
const columnStorageKey = "mu_user_management_visible_columns";

const tableColumns = [
  { key: "id", label: "ID" },
  { key: "username", label: "用户名" },
  { key: "email", label: "邮箱" },
  { key: "edu_email", label: "教育邮箱" },
  { key: "organization_name", label: "组织" },
  { key: "permissions", label: "权限", type: "badge" },
  { key: "activity_count", label: "行为次数", sortable: false },
  { key: "session_count", label: "会话数", sortable: false },
  { key: "last_active_at", label: "最近活跃", type: "date", sortable: false },
  { key: "permissions_new", label: "新权限" },
  { key: "teams_email_reg", label: "Teams 邮箱" },
  { key: "subscribe_start_at", label: "订阅开始", type: "date" },
  { key: "subscribe_end_at", label: "订阅结束", type: "date" },
  { key: "created_at", label: "创建日期", type: "date" },
  { key: "updated_at", label: "更新日期", type: "date" },
  { key: "deleted", label: "已删除" },
];

state.sortBy = "updated_at";
state.sortOrder = "desc";
state.visibleColumns = loadVisibleColumns();

function formatDateInput(date) {
  return date.toISOString().slice(0, 10);
}

function getDefaultMonitorRange() {
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - 29);
  return {
    start: formatDateInput(start),
    end: formatDateInput(end),
  };
}

function ensureRange(prefix, forceReset = false) {
  const startKey = `${prefix}StartDate`;
  const endKey = `${prefix}EndDate`;
  if (!state[startKey] || !state[endKey] || forceReset) {
    const range = getDefaultMonitorRange();
    state[startKey] = range.start;
    state[endKey] = range.end;
  }
  const startInput = els[`${prefix}StartDate`];
  const endInput = els[`${prefix}EndDate`];
  if (startInput) {
    startInput.value = state[startKey];
  }
  if (endInput) {
    endInput.value = state[endKey];
  }
  const audienceInput = els[`${prefix}Audience`];
  if (audienceInput) audienceInput.value = state[`${prefix}Audience`] || "all";
}

function persistRange(prefix) {
  localStorage.setItem(`mu_user_management_${prefix}_start_date`, state[`${prefix}StartDate`]);
  localStorage.setItem(`mu_user_management_${prefix}_end_date`, state[`${prefix}EndDate`]);
  localStorage.setItem(`mu_user_management_${prefix}_audience`, state[`${prefix}Audience`] || "all");
}

function iconRefresh() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${state.token}`,
  };
}

async function request(url, options = {}) {
  const res = await fetch(url, options);
  if (res.status === 401) {
    logout(false);
    throw new Error("登录已过期");
  }
  const text = await res.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { detail: text };
    }
  }
  if (!res.ok) {
    throw new Error(data.detail || "请求失败");
  }
  return data;
}

async function downloadAgentSession(threadId, button) {
  if (!threadId) return;
  const originalHtml = button?.innerHTML || "下载";
  if (button) {
    button.disabled = true;
    button.innerHTML = '<i data-lucide="loader-circle"></i>生成中';
    iconRefresh();
  }
  try {
    const response = await fetch(`/api/reports/agent-sessions/${encodeURIComponent(threadId)}/export`, {
      headers: authHeaders(),
    });
    if (!response.ok) {
      const message = await response.text();
      let detail = message;
      try {
        const data = JSON.parse(message);
        detail = data.detail || detail;
      } catch {
        // Keep the raw response text when the API did not return JSON.
      }
      throw new Error(detail || "导出失败");
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `agent-session-${threadId}.md`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("完整对话已导出");
  } catch (error) {
    showToast(error.message || "导出失败");
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML = originalHtml;
      iconRefresh();
    }
  }
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.remove("hidden");
  setTimeout(() => els.toast.classList.add("hidden"), 2400);
}

function showAdmin(user) {
  els.loginView.classList.add("hidden");
  els.adminView.classList.remove("hidden");
  els.adminName.textContent = user ? `${user.username} · ${user.email || ""}` : "";
  switchView(state.activeView);
  iconRefresh();
}

function showLogin() {
  els.adminView.classList.add("hidden");
  els.loginView.classList.remove("hidden");
  iconRefresh();
}

function switchView(view) {
  state.activeView =
    view === "management" ? "management" : view === "platform" ? "platform" : view === "agent" ? "agent" : "monitor";
  const monitor = state.activeView === "monitor";
  const platform = state.activeView === "platform";
  const agent = state.activeView === "agent";
  const management = state.activeView === "management";
  els.monitorView.classList.toggle("hidden", !monitor);
  els.platformView.classList.toggle("hidden", !platform);
  els.agentView.classList.toggle("hidden", !agent);
  els.managementView.classList.toggle("hidden", !management);
  els.monitorNav.classList.toggle("active", monitor);
  els.platformNav.classList.toggle("active", platform);
  els.agentNav.classList.toggle("active", agent);
  els.managementNav.classList.toggle("active", management);
  els.topbarActions?.classList.toggle("hidden", !management);
  if (monitor) {
    els.pageTitle.textContent = "用户概览";
    els.pageSubtitle.textContent = "查看用户规模、行为活跃度和会话使用情况。";
  } else if (platform) {
    els.pageTitle.textContent = "MU概览";
    els.pageSubtitle.textContent = "查看平台整体用户、活跃与功能使用表现。";
  } else if (agent) {
    els.pageTitle.textContent = "StarSeeker概览";
    els.pageSubtitle.textContent = "查看 StarSeeker 用户提问 Session 列表和会话创建趋势。";
  } else {
    els.pageTitle.textContent = "用户管理";
    els.pageSubtitle.textContent = "搜索、筛选并维护用户账号与权限。";
  }
}

function logout(showMessage = true) {
  state.token = "";
  localStorage.removeItem("mu_user_management_token");
  showLogin();
  if (showMessage) {
    showToast("已退出登录");
  }
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("zh-CN", { hour12: false });
}

function toDateTimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function fromDateTimeLocal(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function addMonths(date, months) {
  const next = new Date(date);
  const day = next.getDate();
  next.setMonth(next.getMonth() + months);
  if (next.getDate() !== day) {
    next.setDate(0);
  }
  return next;
}

function cleanPayload(formData, mode) {
  const payload = {};
  for (const [key, value] of formData.entries()) {
    if (key === "id") continue;
    if (key === "password" && value === "") continue;
    if (value === "") {
      if (mode === "edit" && nullableFields.has(key)) {
        payload[key] = null;
      }
      continue;
    }
    if (dateTimeFields.has(key)) {
      payload[key] = fromDateTimeLocal(value);
    } else {
      payload[key] = value;
    }
  }
  const deletedInput = els.userForm.elements.deleted;
  if (deletedInput) {
    payload.deleted = deletedInput.checked;
  }
  if (mode === "create" && !payload.password) {
    throw new Error("新增用户需要填写密码");
  }
  return payload;
}

function displayValue(value) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "是" : "否";
  return escapeHtml(value);
}

function formatCount(value) {
  return Number(value || 0).toLocaleString("zh-CN");
}

function formatMetricValue(value) {
  return value === null || value === undefined ? "-" : formatCount(value);
}

function formatAverage(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return Number(value).toLocaleString("zh-CN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function formatPercent(numerator, denominator) {
  const total = Number(denominator || 0);
  if (!total) return "-";
  return `${((Number(numerator || 0) / total) * 100).toLocaleString("zh-CN", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function getDaySpan(startDate, endDate) {
  if (!startDate || !endDate) return 1;
  const [sy, sm, sd] = String(startDate).split("-").map(Number);
  const [ey, em, ed] = String(endDate).split("-").map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  const diff = Math.round((end - start) / 86400000) + 1;
  return Math.max(diff, 1);
}

function displayDate(value) {
  return escapeHtml(formatDate(value));
}

function loadVisibleColumns() {
  const allKeys = tableColumns.map((column) => column.key);
  try {
    const saved = JSON.parse(localStorage.getItem(columnStorageKey) || "[]");
    const visible = saved.filter((key) => allKeys.includes(key));
    return visible.length ? visible : allKeys;
  } catch {
    return allKeys;
  }
}

function getVisibleColumns() {
  const visible = new Set(state.visibleColumns);
  return tableColumns.filter((column) => visible.has(column.key));
}

function renderCell(user, column) {
  if (column.type === "date") {
    return displayDate(user[column.key]);
  }
  if (column.type === "badge") {
    return `<span class="badge">${displayValue(user[column.key])}</span>`;
  }
  return displayValue(user[column.key]);
}

function renderTableHeader() {
  els.userTableHeader.innerHTML = `
    ${getVisibleColumns()
      .map((column) => {
        if (column.sortable === false) {
          return `<th><span>${escapeHtml(column.label)}</span></th>`;
        }
        const active = state.sortBy === column.key;
        const icon = active ? (state.sortOrder === "asc" ? "arrow-up" : "arrow-down") : "chevrons-up-down";
        return `
          <th>
            <button class="sort-button ${active ? "active" : ""}" type="button" data-sort-key="${column.key}">
              <span>${escapeHtml(column.label)}</span>
              <i data-lucide="${icon}"></i>
            </button>
          </th>
        `;
      })
      .join("")}
    <th>操作</th>
  `;
  iconRefresh();
}

function renderMiniRows(target, rows, renderRow, colspan = 2) {
  target.innerHTML = rows.length
    ? rows.map(renderRow).join("")
    : `<tr><td colspan="${colspan}" class="cell-muted">暂无数据</td></tr>`;
}

function shiftDateLabel(label, days) {
  const [year, month, day] = String(label).split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  const nextYear = date.getFullYear();
  const nextMonth = String(date.getMonth() + 1).padStart(2, "0");
  const nextDay = String(date.getDate()).padStart(2, "0");
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

function buildDailySeries(startDate, endDate, rows, missingValue = 0) {
  const counts = new Map((rows || []).map((row) => [String(row.bucket_start), Number(row.count || 0)]));
  const series = [];
  for (let label = startDate; label <= endDate; label = shiftDateLabel(label, 1)) {
    series.push({ label, value: counts.has(label) ? counts.get(label) || 0 : missingValue });
  }
  return series;
}

function renderMultiSeriesTrendChart(target, legendTarget, definitions, startDate, endDate) {
  if (!target) return;
  let hiddenKeys = new Set();

  function renderChart() {
    const normalized = definitions.map((item) => ({
      ...item,
      hidden: hiddenKeys.has(item.key),
      series: buildDailySeries(
        startDate,
        endDate,
        item.rows,
        Object.prototype.hasOwnProperty.call(item, "missingValue") ? item.missingValue : 0
      ),
    }));
    const baseSeries = normalized[0]?.series || [];
    if (!baseSeries.length) {
      target.innerHTML = '<div class="trend-empty">暂无数据</div>';
      if (legendTarget) legendTarget.innerHTML = "";
      return;
    }

    const width = 980;
    const height = 380;
    const padding = { top: 16, right: 12, bottom: 42, left: 52 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const visibleSeries = normalized.filter((item) => !item.hidden);
    const maxValue = Math.max(
      ...(visibleSeries.length ? visibleSeries : normalized).flatMap((item) =>
        item.series.map((point) => (point.value === null ? 0 : point.value))
      ),
      1
    );
    const stepX = baseSeries.length > 1 ? chartWidth / (baseSeries.length - 1) : 0;
    const ticks = [0, Math.ceil(maxValue / 2), maxValue];

    const allPointSets = normalized.map((item) => ({
      ...item,
      points: item.series.map((point, index) => {
        const x = padding.left + stepX * index;
        const y = point.value === null ? null : padding.top + chartHeight - (point.value / maxValue) * chartHeight;
        return { ...point, x, y };
      }),
    }));
    const hoverWidth = baseSeries.length > 1 ? chartWidth / (baseSeries.length - 1) : chartWidth;

    const labelIndexes = Array.from(new Set([0, Math.floor((baseSeries.length - 1) / 2), baseSeries.length - 1])).filter(
      (index) => index >= 0
    );

    if (legendTarget) {
      legendTarget.innerHTML = normalized
        .map(
          (item) => `
            <button type="button" class="trend-legend-item ${item.hidden ? "is-muted" : "is-active"}" data-series-key="${item.key}">
              <span class="trend-legend-swatch trend-line-${item.colorClass}" style="background:${item.color}"></span>
              <span>${item.label}</span>
            </button>
          `
        )
        .join("");
    }

    target.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" aria-label="trend chart" role="img">
        ${ticks
          .map((tick) => {
            const y = padding.top + chartHeight - (tick / maxValue) * chartHeight;
            return `
              <line class="trend-grid" x1="${padding.left}" y1="${y}" x2="${padding.left + chartWidth}" y2="${y}"></line>
              <text class="trend-value-label" x="${padding.left - 10}" y="${y + 4}" text-anchor="end">${formatCount(tick)}</text>
            `;
          })
          .join("")}
        <line class="trend-axis" x1="${padding.left}" y1="${padding.top + chartHeight}" x2="${padding.left + chartWidth}" y2="${padding.top + chartHeight}"></line>
        <line class="trend-hover-line hidden" x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${padding.top + chartHeight}"></line>
        ${allPointSets
          .map((item) => {
            if (item.hidden) return "";
            let started = false;
            const linePath = item.points
              .map((point) => {
                if (point.y === null) {
                  started = false;
                  return "";
                }
                const command = `${started ? "L" : "M"} ${point.x} ${point.y}`;
                started = true;
                return command;
              })
              .filter(Boolean)
              .join(" ");
            return `
              <path class="trend-line trend-line-${item.colorClass}" d="${linePath}"></path>
              ${item.points
                .map(
                  (point, index) => `
                    ${
                      point.y === null
                        ? ""
                        : `
                          <circle class="trend-point trend-point-${item.colorClass}" cx="${point.x}" cy="${point.y}" r="3"></circle>
                          <g class="trend-active-point hidden" data-series="${item.key}" data-index="${index}">
                            <circle class="trend-point-${item.colorClass}" cx="${point.x}" cy="${point.y}" r="6"></circle>
                          </g>
                        `
                    }
                  `
                )
                .join("")}
            `;
          })
          .join("")}
        ${labelIndexes
          .map((index) => {
            const point = allPointSets[0].points[index];
            return `<text class="trend-axis-label" x="${point.x}" y="${height - 12}" text-anchor="middle">${point.label.slice(5)}</text>`;
          })
          .join("")}
        ${baseSeries
          .map((point, index) => {
            const startX = index === 0 ? padding.left : point.x - hoverWidth / 2;
            const rectWidth = baseSeries.length === 1 ? chartWidth : index === baseSeries.length - 1 ? padding.left + chartWidth - startX : hoverWidth;
            return `
              <rect
                class="trend-hover-target"
                data-index="${index}"
                x="${startX}"
                y="${padding.top}"
                width="${rectWidth}"
                height="${chartHeight}"
              ></rect>
            `;
          })
          .join("")}
      </svg>
      <div class="trend-tooltip hidden" aria-hidden="true"></div>
    `;

    const svg = target.querySelector("svg");
    const tooltip = target.querySelector(".trend-tooltip");
    const hoverLine = target.querySelector(".trend-hover-line");
    const activePoints = Array.from(target.querySelectorAll(".trend-active-point"));
    const hoverTargets = Array.from(target.querySelectorAll(".trend-hover-target"));
    if (!svg || !tooltip || !hoverLine || !hoverTargets.length) return;

    function hideHoverState() {
      hoverLine.classList.add("hidden");
      tooltip.classList.add("hidden");
      tooltip.classList.remove("visible");
      tooltip.classList.remove("pinned");
      activePoints.forEach((node) => node.classList.add("hidden"));
    }

    function showHoverState(index, pinned = false) {
      const focusPoints = allPointSets
        .filter((item) => !item.hidden)
        .map((item) => ({
          key: item.key,
          label: item.label,
          color: item.color,
          point: item.points[index],
        }));
      const anchorPoint = baseSeries[index];
      if (!anchorPoint) return;

      hoverLine.setAttribute("x1", String(anchorPoint.x));
      hoverLine.setAttribute("x2", String(anchorPoint.x));
      hoverLine.classList.remove("hidden");

      activePoints.forEach((node) => {
        const matches = Number(node.dataset.index) === index && !hiddenKeys.has(node.dataset.series);
        node.classList.toggle("hidden", !matches);
      });

      tooltip.innerHTML = `
        <div class="trend-tooltip-date">${anchorPoint.label}</div>
        ${focusPoints
          .map(
            (item) => `
              <div class="trend-tooltip-row">
                <span class="trend-tooltip-label">
                  <span class="trend-tooltip-dot" style="background:${item.color}"></span>
                  ${item.label}
                </span>
                <strong class="trend-tooltip-value">${formatMetricValue(item.point.value)}</strong>
              </div>
            `
          )
          .join("")}
      `;

      const svgRect = svg.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const scaleX = svgRect.width / width;
      const scaleY = svgRect.height / height;
      const pixelX = (anchorPoint.x - padding.left) * scaleX + 12;
      const visibleYs = focusPoints.map((item) => item.point.y).filter((value) => value !== null);
      const pixelY = Math.max(
        12,
        (visibleYs.length ? Math.min(...visibleYs.map((value) => value * scaleY)) : padding.top + chartHeight * 0.4) - 18
      );

      tooltip.classList.remove("hidden");
      tooltip.classList.add("visible");
      tooltip.classList.toggle("pinned", pinned);

      const tooltipWidth = tooltip.offsetWidth || 160;
      const tooltipHeight = tooltip.offsetHeight || 96;
      const left = Math.max(12, Math.min(pixelX, targetRect.width - tooltipWidth - 12));
      const top = Math.max(12, Math.min(pixelY, svgRect.height - tooltipHeight - 12));
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
    }

    function getIndexFromClientX(clientX) {
      const svgRect = svg.getBoundingClientRect();
      if (!svgRect.width) return baseSeries.length - 1;
      const scaleX = svgRect.width / width;
      const left = padding.left * scaleX;
      const right = (padding.left + chartWidth) * scaleX;
      const clamped = Math.max(left, Math.min(clientX - svgRect.left, right));
      const ratio = chartWidth <= 0 ? 1 : (clamped - left) / (right - left || 1);
      return Math.max(0, Math.min(baseSeries.length - 1, Math.round(ratio * (baseSeries.length - 1))));
    }

    hoverTargets.forEach((node) => {
      const index = Number(node.dataset.index);
      node.addEventListener("mouseenter", () => showHoverState(index));
      node.addEventListener("mousemove", () => showHoverState(index));
      node.addEventListener("click", () => showHoverState(index, true));
    });
    svg.addEventListener("mousemove", (event) => showHoverState(getIndexFromClientX(event.clientX)));
    svg.addEventListener("click", (event) => showHoverState(getIndexFromClientX(event.clientX), true));
    target.addEventListener("mouseleave", hideHoverState);
    showHoverState(baseSeries.length - 1, true);

    if (legendTarget) {
      Array.from(legendTarget.querySelectorAll(".trend-legend-item")).forEach((button) => {
        button.addEventListener("click", () => {
          const key = button.dataset.seriesKey;
          if (!key) return;
          const visibleCount = normalized.filter((item) => !hiddenKeys.has(item.key)).length;
          if (!hiddenKeys.has(key) && visibleCount === 1) return;
          if (hiddenKeys.has(key)) {
            hiddenKeys.delete(key);
          } else {
            hiddenKeys.add(key);
          }
          renderChart();
        });
      });
    }
  }

  renderChart();
}

function renderCombinedTrendChart(target, legendTarget, trendSeries, startDate, endDate) {
  renderMultiSeriesTrendChart(
    target,
    legendTarget,
    [
      { key: "registered_total", label: "注册用户数", colorClass: "signup", color: "#126e7a", rows: trendSeries.registeredTotal || [] },
      { key: "new_registered", label: "新注册用户数", colorClass: "session", color: "#b64d2f", rows: trendSeries.newRegistered || [] },
      { key: "login_user", label: "登录用户数", colorClass: "login-user", color: "#7c3aed", rows: [], missingValue: null },
      {
        key: "active_user",
        label: "活跃用户数",
        colorClass: "active-user",
        color: "#0f9f6e",
        rows: trendSeries.activeUser || [],
      },
      { key: "activity", label: "活跃次数", colorClass: "activity", color: "#3d7af0", rows: trendSeries.activity || [] },
      { key: "avg_activity", label: "人均活跃次数", colorClass: "session", color: "#d97706", rows: trendSeries.avgActivity || [] },
      { key: "avg_duration", label: "人均停留时长", colorClass: "login-count", color: "#9ca3af", rows: [], missingValue: null },
    ],
    startDate,
    endDate
  );
}

const distributionColors = ["#126e7a", "#d26a43", "#3d7af0", "#0f9f6e", "#d6a431", "#6d5bd0", "#d14f73", "#78909c"];

function renderDistribution(target, rows, { pieLimit = 8, rankLimit = 10, page = 1, onPageChange = null } = {}) {
  if (!target) return;
  const normalized = (rows || [])
    .map((row) => ({ label: row.label || "未设置", count: Number(row.count || 0) }))
    .filter((row) => row.count > 0);
  const total = normalized.reduce((sum, row) => sum + row.count, 0);
  if (!total) {
    target.innerHTML = '<div class="trend-empty">暂无数据</div>';
    return;
  }

  const pieRows = normalized.slice(0, pieLimit);
  const remainder = normalized.slice(pieLimit).reduce((sum, row) => sum + row.count, 0);
  if (remainder) pieRows.push({ label: "其他", count: remainder });
  const totalPages = Math.max(1, Math.ceil(normalized.length / rankLimit));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const rankStart = (currentPage - 1) * rankLimit;
  const visibleRankRows = normalized.slice(rankStart, rankStart + rankLimit);
  let cursor = 0;
  const segments = pieRows.map((row, index) => {
    const start = cursor;
    cursor += (row.count / total) * 360;
    return `${distributionColors[index % distributionColors.length]} ${start}deg ${cursor}deg`;
  });

  target.innerHTML = `
    <div class="distribution-visual">
      <div class="distribution-pie" style="background: conic-gradient(${segments.join(", ")})">
        <div class="distribution-pie-center"><strong>${formatCount(total)}</strong><span>用户</span></div>
      </div>
      <div class="distribution-legend">
        ${pieRows.map((row, index) => `
          <div><span class="distribution-dot" style="background:${distributionColors[index % distributionColors.length]}"></span><span>${escapeHtml(row.label)}</span><strong>${formatPercent(row.count, total)}</strong></div>
        `).join("")}
      </div>
    </div>
    <div class="distribution-ranking">
      ${visibleRankRows.map((row, index) => `
        <div class="distribution-rank-row">
          <span class="distribution-rank-index">${rankStart + index + 1}</span>
          <div class="distribution-rank-main">
            <div><strong title="${escapeHtml(row.label)}">${escapeHtml(row.label)}</strong><span>${formatCount(row.count)} · ${formatPercent(row.count, total)}</span></div>
            <div class="distribution-rank-track"><span style="width:${(row.count / normalized[0].count) * 100}%"></span></div>
          </div>
        </div>
      `).join("")}
    </div>
    ${onPageChange && totalPages > 1 ? `
      <div class="agent-table-pager distribution-pager">
        <span>${currentPage} / ${totalPages} · ${normalized.length} 项</span>
        <div><button type="button" class="tool-button distribution-prev" ${currentPage <= 1 ? "disabled" : ""}>上一页</button><button type="button" class="tool-button distribution-next" ${currentPage >= totalPages ? "disabled" : ""}>下一页</button></div>
      </div>
    ` : ""}
  `;
  target.querySelector(".distribution-prev")?.addEventListener("click", () => onPageChange(currentPage - 1));
  target.querySelector(".distribution-next")?.addEventListener("click", () => onPageChange(currentPage + 1));
}

function renderAgentTrendChart(target, legendTarget, trendSeries, startDate, endDate) {
  renderMultiSeriesTrendChart(
    target,
    legendTarget,
    [
      { key: "session_create", label: "创建会话次数", colorClass: "activity", color: "#3d7af0", rows: trendSeries.sessionCreate || [] },
      { key: "session_users", label: "创建会话用户数", colorClass: "active-user", color: "#0f9f6e", rows: trendSeries.sessionUsers || [] },
    ],
    startDate,
    endDate
  );
}

function renderPlatformTrendChart(target, legendTarget, trendSeries, startDate, endDate) {
  renderMultiSeriesTrendChart(
    target,
    legendTarget,
    [
      { key: "registered_total", label: "注册用户数", colorClass: "signup", color: "#126e7a", rows: trendSeries.registeredTotal || [] },
      { key: "new_registered", label: "新注册用户数", colorClass: "session", color: "#b64d2f", rows: trendSeries.newRegistered || [] },
      { key: "login_users", label: "登录用户数", colorClass: "login-user", color: "#7c3aed", rows: trendSeries.loginUsers || [], missingValue: null },
      { key: "login_count", label: "登录次数", colorClass: "login-count", color: "#9ca3af", rows: trendSeries.loginCount || [], missingValue: null },
      {
        key: "active_user",
        label: "活跃用户数",
        colorClass: "active-user",
        color: "#0f9f6e",
        rows: trendSeries.activeUser || [],
      },
      { key: "active_count", label: "活跃次数", colorClass: "activity", color: "#3d7af0", rows: trendSeries.activeCount || [] },
      { key: "active_rate", label: "平台活跃率（%）", colorClass: "session", color: "#d97706", rows: trendSeries.activeRate || [] },
      { key: "average_activity", label: "人均活跃次数", colorClass: "login-count", color: "#64748b", rows: trendSeries.averageActivity || [] },
    ],
    startDate,
    endDate
  );
}

function renderFeatureUsageTrendGrid(target, trendRows, summaryRows, startDate, endDate) {
  if (!target) return;
  const featureNames = [
    "StarSeeker",
    "Ask",
    "search",
    "MD",
    "cell life predict",
    "electrolyte design",
    "electrode forward design",
    "electrode inverse design",
  ];
  const grouped = new Map();
  for (const row of trendRows || []) {
    const key = row.feature_name;
    if (!grouped.has(key)) {
      grouped.set(key, { callCount: [], userCount: [] });
    }
    grouped.get(key).callCount.push({ bucket_start: row.bucket_start, count: row.call_count });
    grouped.get(key).userCount.push({ bucket_start: row.bucket_start, count: row.user_count });
  }

  target.innerHTML = featureNames
    .map(
      (featureName, index) => `
        <article class="feature-trend-card">
          <div class="panel-title">
            <h3>${escapeHtml(featureName)}</h3>
            <button type="button" class="icon-button feature-expand-button" data-feature-index="${index}" title="放大查看" aria-label="放大查看 ${escapeHtml(featureName)} 趋势图">
              <i data-lucide="maximize-2"></i>
            </button>
          </div>
          <div id="featureTrendLegend-${index}" class="trend-legend trend-legend-compact"></div>
          <div id="featureTrendChart-${index}" class="trend-chart trend-chart-compact"></div>
        </article>
      `
    )
    .join("");

  featureNames.forEach((featureName, index) => {
    const rows = grouped.get(featureName) || { callCount: [], userCount: [] };
    const definitions = [
      { key: `${featureName}-call`, label: "调用次数", colorClass: "activity", color: "#3d7af0", rows: rows.callCount },
      { key: `${featureName}-user`, label: "调用用户数", colorClass: "active-user", color: "#0f9f6e", rows: rows.userCount },
    ];
    renderMultiSeriesTrendChart(
      target.querySelector(`#featureTrendChart-${index}`),
      target.querySelector(`#featureTrendLegend-${index}`),
      definitions,
      startDate,
      endDate
    );
    target.querySelector(`[data-feature-index="${index}"]`)?.addEventListener("click", () => {
      if (!els.featureTrendDialog) return;
      els.featureTrendDialogTitle.textContent = `${featureName} 按天趋势`;
      renderMultiSeriesTrendChart(
        els.featureTrendDialogChart,
        els.featureTrendDialogLegend,
        definitions,
        startDate,
        endDate
      );
      els.featureTrendDialog.showModal();
    });
  });
  iconRefresh();
}

function renderMonitorDashboard() {
  const dashboard = state.monitorDashboard;
  if (!dashboard) {
    els.overviewCards.innerHTML = "";
    renderMiniRows(els.topEndpointsBody, [], () => "");
    renderMiniRows(els.topUsersBody, [], () => "", 3);
    if (els.combinedTrendLegend) {
      els.combinedTrendLegend.innerHTML = "";
    }
    if (els.combinedTrendChart) {
      els.combinedTrendChart.innerHTML = "";
    }
    if (els.roleDistribution) els.roleDistribution.innerHTML = "";
    if (els.organizationDistribution) els.organizationDistribution.innerHTML = "";
    return;
  }

  const meta = dashboard.meta || {};
  const overview = dashboard.overview || {};
  const averageActivity = Number(overview.activity_in_period || 0) / Math.max(Number(overview.active_users_in_period || 0), 1);
  const cards = [
    ["注册用户数", formatCount(overview.registered_users_total), "截至所选区间最后一天的累计有效用户数"],
    ["新注册用户数", formatCount(overview.signups_in_period), "所选区间内新增的有效用户数"],
    ["登录用户数", "-", "暂无真实 login 事件源，暂不计算"],
    ["活跃用户数", formatCount(overview.active_users_in_period), "umap_db 与 StarSeeker 用户合并去重"],
    ["活跃次数", formatCount(overview.activity_in_period), "umap_db activity + StarSeeker Session"],
    ["人均活跃次数", formatAverage(averageActivity), "活跃次数 / 活跃用户数"],
    ["人均停留时长", "-", "暂无可靠进入与离开时间数据，暂不计算"],
  ];

  els.monitorGranularityHint.textContent =
    meta.range_summary || "选择日期区间后，趋势会自动按合适的周期聚合。";
  ensureRange("monitor");

  els.overviewCards.innerHTML = cards
    .map(
      ([label, value, note]) => `
        <article class="overview-card">
          <div class="overview-label">${escapeHtml(label)}</div>
          <div class="overview-value">${escapeHtml(value)}</div>
          <div class="overview-note">${escapeHtml(note)}</div>
        </article>
      `
    )
    .join("");

  const activeUserByDay = new Map((dashboard.active_user_trend || []).map((row) => [String(row.bucket_start), Number(row.count || 0)]));
  const averageActivityTrend = (dashboard.activity_trend || []).map((row) => ({
    bucket_start: row.bucket_start,
    count: Number(row.count || 0) / Math.max(activeUserByDay.get(String(row.bucket_start)) || 0, 1),
  }));

  renderCombinedTrendChart(
    els.combinedTrendChart,
    els.combinedTrendLegend,
    {
      registeredTotal: dashboard.platform_registered_user_trend || [],
      newRegistered: dashboard.signup_trend || [],
      activity: dashboard.activity_trend || [],
      activeUser: dashboard.active_user_trend || [],
      avgActivity: averageActivityTrend,
    },
    meta.start_date,
    meta.end_date
  );
  renderDistribution(els.roleDistribution, dashboard.user_role_distribution || [], { pieLimit: 7, rankLimit: 10 });
  renderDistribution(els.organizationDistribution, dashboard.user_organization_distribution || [], {
    pieLimit: 7,
    rankLimit: 10,
    page: state.monitorOrganizationPage,
    onPageChange: (page) => {
      state.monitorOrganizationPage = page;
      renderMonitorDashboard();
    },
  });
  const endpointRows = dashboard.top_endpoints || [];
  const endpointTotalPages = Math.max(1, Math.ceil(endpointRows.length / state.monitorTablePageSize));
  state.monitorEndpointPage = Math.min(Math.max(state.monitorEndpointPage, 1), endpointTotalPages);
  const visibleEndpointRows = endpointRows.slice(
    (state.monitorEndpointPage - 1) * state.monitorTablePageSize,
    state.monitorEndpointPage * state.monitorTablePageSize
  );
  renderMiniRows(
    els.topEndpointsBody,
    visibleEndpointRows,
    (row) => `
      <tr>
        <td>${displayValue(row.endpoint)}</td>
        <td>${formatCount(row.count)}</td>
      </tr>
    `
  );
  if (els.monitorEndpointPageInfo) els.monitorEndpointPageInfo.textContent = `${state.monitorEndpointPage} / ${endpointTotalPages} · ${endpointRows.length} 个接口`;
  if (els.monitorEndpointPrev) els.monitorEndpointPrev.disabled = state.monitorEndpointPage <= 1;
  if (els.monitorEndpointNext) els.monitorEndpointNext.disabled = state.monitorEndpointPage >= endpointTotalPages;
  const activeUserRows = dashboard.top_users || [];
  const activeUserTotalPages = Math.max(1, Math.ceil(activeUserRows.length / state.monitorTablePageSize));
  state.monitorUserPage = Math.min(Math.max(state.monitorUserPage, 1), activeUserTotalPages);
  const visibleActiveUserRows = activeUserRows.slice(
    (state.monitorUserPage - 1) * state.monitorTablePageSize,
    state.monitorUserPage * state.monitorTablePageSize
  );
  renderMiniRows(
    els.topUsersBody,
    visibleActiveUserRows,
    (row) => `
      <tr>
        <td>
          <div class="metric-user">
            <strong>${displayValue(row.username || row.email || `用户 ${row.user_id}`)}</strong>
            <span>${displayValue(row.email)}</span>
          </div>
        </td>
        <td>${displayValue(row.organization_name)}</td>
        <td>${formatCount(row.activity_count)}</td>
      </tr>
    `,
    3
  );
  if (els.monitorUserPageInfo) els.monitorUserPageInfo.textContent = `${state.monitorUserPage} / ${activeUserTotalPages} · ${activeUserRows.length} 位用户`;
  if (els.monitorUserPrev) els.monitorUserPrev.disabled = state.monitorUserPage <= 1;
  if (els.monitorUserNext) els.monitorUserNext.disabled = state.monitorUserPage >= activeUserTotalPages;
}

function renderPlatformDashboard() {
  const dashboard = state.platformDashboard;
  if (!dashboard) {
    if (els.platformOverviewCards) {
      els.platformOverviewCards.innerHTML = "";
    }
    if (els.featureUsageCards) {
      els.featureUsageCards.innerHTML = "";
    }
    if (els.featureUsageBody) {
      els.featureUsageBody.innerHTML = "";
    }
    if (els.featureTrendGrid) {
      els.featureTrendGrid.innerHTML = "";
    }
    return;
  }

  const meta = dashboard.meta || {};
  const overview = dashboard.overview || {};
  if (els.platformGranularityHint) {
    els.platformGranularityHint.textContent =
      meta.range_summary || "选择 MU 概览的日期区间后，平台概览和功能使用会独立刷新。";
  }
  ensureRange("platform");

  const platformActiveUsers = Number(overview.active_users_in_period || 0);
  const platformRegisteredUsers = Number(overview.registered_users_total || 0);
  const platformActiveCount = Number(overview.activity_in_period || 0);
  const platformCards = [
    ["注册用户数", formatCount(overview.registered_users_total), "取所选统计时间段最后一天的累计注册用户数"],
    ["新注册用户数", formatCount(overview.signups_in_period), "统计时间段内新增的有效用户数"],
    ["登录用户数", "-", "暂无登录日志数据，待后续补充真实 login 事件源"],
    ["登录次数", "-", "暂无登录日志数据，每登录一次计一次的口径暂无法计算"],
    ["活跃用户数", formatCount(overview.active_users_in_period), "umap_db 活跃用户与 StarSeeker 用户按用户名合并去重"],
    ["活跃次数", formatCount(overview.activity_in_period), "umap_db activity 记录 + Deerflow thread 记录"],
    ["平台活跃率", formatPercent(platformActiveUsers, platformRegisteredUsers), "活跃用户数 / 累计注册用户数"],
    ["人均活跃次数", formatAverage(platformActiveCount / Math.max(platformActiveUsers, 1)), "活跃次数 / 活跃用户数"],
  ];

  if (els.platformOverviewCards) {
    els.platformOverviewCards.innerHTML = platformCards
      .map(
        ([label, value, note]) => `
          <article class="overview-card">
            <div class="overview-label">${escapeHtml(label)}</div>
            <div class="overview-value">${escapeHtml(value)}</div>
            <div class="overview-note">${escapeHtml(note)}</div>
          </article>
        `
      )
      .join("");
  }

  const registeredByDay = new Map(
    (dashboard.platform_registered_user_trend || []).map((row) => [String(row.bucket_start), Number(row.count || 0)])
  );
  const activeUsersByDay = new Map(
    (dashboard.active_user_trend || []).map((row) => [String(row.bucket_start), Number(row.count || 0)])
  );
  const platformActiveRateTrend = (dashboard.platform_registered_user_trend || []).map((row) => ({
    bucket_start: row.bucket_start,
    count: registeredByDay.get(String(row.bucket_start))
      ? (100 * (activeUsersByDay.get(String(row.bucket_start)) || 0)) / registeredByDay.get(String(row.bucket_start))
      : 0,
  }));
  const platformAverageActivityTrend = (dashboard.activity_trend || []).map((row) => ({
    bucket_start: row.bucket_start,
    count: Number(row.count || 0) / Math.max(activeUsersByDay.get(String(row.bucket_start)) || 0, 1),
  }));

  renderPlatformTrendChart(
    els.platformTrendChart,
    els.platformTrendLegend,
    {
      registeredTotal: dashboard.platform_registered_user_trend || [],
      newRegistered: dashboard.signup_trend || [],
      loginUsers: [],
      loginCount: [],
      activeUser: dashboard.active_user_trend || [],
      activeCount: dashboard.activity_trend || [],
      activeRate: platformActiveRateTrend,
      averageActivity: platformAverageActivityTrend,
    },
    meta.start_date,
    meta.end_date
  );

  const featureUsageRows = dashboard.feature_usage || [];
  const featureDaySpan = getDaySpan(meta.start_date, meta.end_date);
  if (els.featureUsageCards) {
    els.featureUsageCards.innerHTML = featureUsageRows
      .map(
        (row) => `
          <article class="overview-card">
            <div class="overview-label">${escapeHtml(row.feature_name || "-")}</div>
            <div class="overview-value">${formatCount(row.call_count)}</div>
            <div class="overview-note">调用用户数 ${formatCount(row.user_count)} · 人均 ${formatAverage(Number(row.call_count || 0) / Math.max(Number(row.user_count || 0), 1))} · 日均 ${formatAverage(Number(row.call_count || 0) / featureDaySpan)}</div>
          </article>
        `
      )
      .join("");
  }

  renderMiniRows(
    els.featureUsageBody,
    featureUsageRows,
    (row) => `
      <tr>
        <td>${escapeHtml(row.feature_name || "-")}</td>
        <td>${formatCount(row.call_count)}</td>
        <td>${formatCount(row.user_count)}</td>
        <td>${formatAverage(Number(row.call_count || 0) / Math.max(Number(row.user_count || 0), 1))}</td>
        <td>${formatAverage(Number(row.call_count || 0) / featureDaySpan)}</td>
      </tr>
    `,
    5
  );

  renderFeatureUsageTrendGrid(
    els.featureTrendGrid,
    dashboard.feature_usage_trend || [],
    featureUsageRows,
    meta.start_date,
    meta.end_date
  );
}

function renderAgentDashboard() {
  const dashboard = state.agentDashboard;
  if (!dashboard) {
    if (els.agentUsageCards) {
      els.agentUsageCards.innerHTML = "";
    }
    if (els.agentRetentionCards) {
      els.agentRetentionCards.innerHTML = "";
    }
    if (els.agentUserListBody) {
      els.agentUserListBody.innerHTML = "";
    }
    if (els.agentStickinessDistributionBody) {
      els.agentStickinessDistributionBody.innerHTML = "";
    }
    if (els.agentStickyUserBody) {
      els.agentStickyUserBody.innerHTML = "";
    }
    if (els.agentRetentionAnalysis) {
      els.agentRetentionAnalysis.innerHTML = "";
    }
    if (els.agentUsageBody) {
      els.agentUsageBody.innerHTML = "";
    }
    if (els.agentTrendLegend) {
      els.agentTrendLegend.innerHTML = "";
    }
    if (els.agentTrendChart) {
      els.agentTrendChart.innerHTML = "";
    }
    if (els.agentUserDistribution) els.agentUserDistribution.innerHTML = "";
    if (els.agentOrganizationDistribution) els.agentOrganizationDistribution.innerHTML = "";
    return;
  }

  const meta = dashboard.meta || {};
  if (els.agentGranularityHint) {
    els.agentGranularityHint.textContent =
      meta.range_summary || "数据来源为 `deerflow_prod`，切换日期区间后会独立刷新 Agent 监控。";
  }
  ensureRange("agent");

  const agentOverview = dashboard.agent_usage_overview || {};
  const retentionOverview = dashboard.agent_retention_overview || {};
  if (els.agentUsageCards) {
    els.agentUsageCards.innerHTML = [
      ["创建会话次数", formatCount(agentOverview.session_creations), `${meta.current_label || "当前周期"}内 Deerflow store 新建 thread 记录`],
      ["创建会话用户数", formatCount(agentOverview.session_users), "Deerflow thread 按用户名去重统计"],
      [
        "平均会话轮数",
        formatAverage(agentOverview.average_session_rounds),
        "每个 Session 的 min(用户提问数, Agent 回答数) 的平均值",
      ],
      [
        "人均创建会话次数",
        formatAverage(Number(agentOverview.session_creations || 0) / Math.max(Number(agentOverview.session_users || 0), 1)),
        "创建会话次数 / 创建会话用户数",
      ],
    ]
      .map(
        ([label, value, note]) => `
          <article class="overview-card">
            <div class="overview-label">${escapeHtml(label)}</div>
            <div class="overview-value">${escapeHtml(value)}</div>
            <div class="overview-note">${escapeHtml(note)}</div>
          </article>
        `
      )
      .join("");
  }

  renderDistribution(els.agentUserDistribution, dashboard.agent_user_distribution || [], { pieLimit: 7, rankLimit: 10 });
  renderDistribution(els.agentOrganizationDistribution, dashboard.agent_organization_distribution || [], { pieLimit: 7, rankLimit: 10 });

  if (els.agentRetentionCards) {
    els.agentRetentionCards.innerHTML = [
      [
        "回访用户数",
        formatCount(retentionOverview.returning_users),
        `统计区间内至少 ${2} 天创建 Session 的用户数`,
      ],
      [
        "回访率",
        formatPercent(retentionOverview.returning_users, retentionOverview.session_users),
        "回访用户数 / 创建会话用户数",
      ],
      [
        "高粘性用户数",
        formatCount(retentionOverview.sticky_users),
        `统计区间内至少 ${3} 天创建 Session 的用户数`,
      ],
      [
        "跨周活跃用户数",
        formatCount(retentionOverview.multi_week_users),
        "统计区间内覆盖至少 2 个自然周的用户数",
      ],
      [
        "人均活跃天数",
        formatAverage(retentionOverview.avg_active_days),
        "创建会话用户在区间内的平均活跃天数",
      ],
    ]
      .map(
        ([label, value, note]) => `
          <article class="overview-card">
            <div class="overview-label">${escapeHtml(label)}</div>
            <div class="overview-value">${escapeHtml(value)}</div>
            <div class="overview-note">${escapeHtml(note)}</div>
          </article>
        `
      )
      .join("");
  }

  const userRows = dashboard.agent_user_list || [];
  const userTotalPages = Math.max(1, Math.ceil(userRows.length / state.agentTablePageSize));
  state.agentUserPage = Math.min(Math.max(state.agentUserPage, 1), userTotalPages);
  const visibleUserRows = userRows.slice(
    (state.agentUserPage - 1) * state.agentTablePageSize,
    state.agentUserPage * state.agentTablePageSize
  );
  renderMiniRows(
    els.agentUserListBody,
    visibleUserRows,
    (row) => `
      <tr>
        <td>${escapeHtml(row.username || "-")}</td>
        <td>${escapeHtml(row.organization_name || "-")}</td>
        <td>${formatCount(row.session_creations)}</td>
        <td>${escapeHtml(formatDate(row.last_created_at))}</td>
      </tr>
    `,
    4
  );
  if (els.agentUserPageInfo) els.agentUserPageInfo.textContent = `${state.agentUserPage} / ${userTotalPages} · ${userRows.length} 位用户`;
  if (els.agentUserPrev) els.agentUserPrev.disabled = state.agentUserPage <= 1;
  if (els.agentUserNext) els.agentUserNext.disabled = state.agentUserPage >= userTotalPages;

  renderMiniRows(
    els.agentStickinessDistributionBody,
    dashboard.agent_stickiness_distribution || [],
    (row) => `
      <tr>
        <td>${escapeHtml(row.bucket || "-")}</td>
        <td>${formatCount(row.user_count)}</td>
      </tr>
    `
  );

  const stickyUserRows = dashboard.agent_sticky_user_list || [];
  const stickyUserTotalPages = Math.max(1, Math.ceil(stickyUserRows.length / state.agentStickyUserPageSize));
  state.agentStickyUserPage = Math.min(Math.max(state.agentStickyUserPage, 1), stickyUserTotalPages);
  const visibleStickyUserRows = stickyUserRows.slice(
    (state.agentStickyUserPage - 1) * state.agentStickyUserPageSize,
    state.agentStickyUserPage * state.agentStickyUserPageSize
  );
  renderMiniRows(
    els.agentStickyUserBody,
    visibleStickyUserRows,
    (row) => `
      <tr>
        <td>${escapeHtml(row.username || "-")}</td>
        <td>${escapeHtml(row.organization_name || "-")}</td>
        <td>${formatCount(row.active_days)}</td>
        <td>${formatCount(row.active_weeks)}</td>
        <td>${formatCount(row.session_creations)}</td>
        <td>${escapeHtml(formatDate(row.last_created_at))}</td>
      </tr>
    `,
    6
  );
  if (els.agentStickyUserPageInfo) els.agentStickyUserPageInfo.textContent = `${state.agentStickyUserPage} / ${stickyUserTotalPages} · ${stickyUserRows.length} 位用户`;
  if (els.agentStickyUserPrev) els.agentStickyUserPrev.disabled = state.agentStickyUserPage <= 1;
  if (els.agentStickyUserNext) els.agentStickyUserNext.disabled = state.agentStickyUserPage >= stickyUserTotalPages;

  const sessionRows = dashboard.agent_usage || [];
  const sessionTotalPages = Math.max(1, Math.ceil(sessionRows.length / state.agentTablePageSize));
  state.agentSessionPage = Math.min(Math.max(state.agentSessionPage, 1), sessionTotalPages);
  const visibleSessionRows = sessionRows.slice(
    (state.agentSessionPage - 1) * state.agentTablePageSize,
    state.agentSessionPage * state.agentTablePageSize
  );
  renderMiniRows(
    els.agentUsageBody,
    visibleSessionRows,
    (row) => `
      <tr>
        <td>${escapeHtml(row.username || "-")}</td>
        <td>${escapeHtml(row.organization_name || "-")}</td>
        <td>${escapeHtml(row.name || "-")}</td>
        <td>${escapeHtml(formatDate(row.created_at))}</td>
        <td><button type="button" class="tool-button agent-download-button" data-thread-id="${escapeHtml(row.thread_id || "")}"><i data-lucide="download"></i>下载</button></td>
      </tr>
    `,
    5
  );
  if (els.agentSessionPageInfo) els.agentSessionPageInfo.textContent = `${state.agentSessionPage} / ${sessionTotalPages} · ${sessionRows.length} 个 Session`;
  if (els.agentSessionPrev) els.agentSessionPrev.disabled = state.agentSessionPage <= 1;
  if (els.agentSessionNext) els.agentSessionNext.disabled = state.agentSessionPage >= sessionTotalPages;
  Array.from(els.agentUsageBody?.querySelectorAll(".agent-download-button") || []).forEach((button) => {
    button.addEventListener("click", () => downloadAgentSession(button.dataset.threadId, button));
  });
  iconRefresh();

  renderAgentTrendChart(
    els.agentTrendChart,
    els.agentTrendLegend,
    {
      sessionCreate: dashboard.agent_session_trend || [],
      sessionUsers: dashboard.agent_user_trend || [],
      averageRounds: dashboard.agent_round_trend || [],
    },
    meta.start_date,
    meta.end_date
  );
}

function renderDashboards() {
  renderMonitorDashboard();
  renderPlatformDashboard();
  renderAgentDashboard();
}

function renderColumnMenu() {
  const visible = new Set(state.visibleColumns);
  els.columnMenu.innerHTML = tableColumns
    .map(
      (column) => `
        <label class="column-option">
          <input type="checkbox" value="${column.key}" ${visible.has(column.key) ? "checked" : ""} />
          ${escapeHtml(column.label)}
        </label>
      `
    )
    .join("");
}

function renderTable() {
  const totalPages = Math.max(1, Math.ceil(state.total / state.pageSize));
  els.resultSummary.textContent = `${state.total} 个用户`;
  els.pageInfo.textContent = `${state.page} / ${totalPages}`;
  els.prevPage.disabled = state.page <= 1;
  els.nextPage.disabled = state.page >= totalPages;
  els.emptyState.classList.toggle("hidden", state.users.length > 0);

  els.userTableBody.innerHTML = state.users
    .map(
      (user) => `
        <tr>
          ${getVisibleColumns().map((column) => `<td>${renderCell(user, column)}</td>`).join("")}
          <td>
            <div class="row-actions">
              <button class="icon-button" title="编辑" aria-label="编辑" data-action="edit" data-id="${user.id}">
                <i data-lucide="pencil"></i>
              </button>
              <button class="icon-button" title="发送临时密码邮件" aria-label="发送临时密码邮件" data-action="send-email" data-id="${user.id}">
                <i data-lucide="mail"></i>
              </button>
              <button class="icon-button" title="删除" aria-label="删除" data-action="delete" data-id="${user.id}">
                <i data-lucide="trash-2"></i>
              </button>
            </div>
          </td>
        </tr>
      `
    )
    .join("");
  iconRefresh();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadUsers() {
  const params = new URLSearchParams({
    page: String(state.page),
    page_size: String(state.pageSize),
    sort_by: state.sortBy,
    sort_order: state.sortOrder,
  });
  for (const [key, value] of Object.entries(state.filters)) {
    if (value) params.set(key, value);
  }
  const data = await request(`/api/users?${params.toString()}`, {
    headers: authHeaders(),
  });
  state.total = data.total;
  state.users = data.data;
  await loadUserActivity();
  renderTableHeader();
  renderTable();
}

async function fetchDashboard(startDate, endDate, audience = "all", { includeAgentRounds = false } = {}) {
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
  });
  params.set("audience", audience);
  if (includeAgentRounds) params.set("include_agent_rounds", "true");
  return request(`/api/reports/dashboard?${params.toString()}`, {
    headers: authHeaders(),
  });
}

async function loadMonitorDashboard() {
  const dashboard = await fetchDashboard(state.monitorStartDate, state.monitorEndDate, state.monitorAudience);
  state.monitorDashboard = dashboard;
  state.monitorOrganizationPage = 1;
  state.monitorEndpointPage = 1;
  state.monitorUserPage = 1;
  if (dashboard?.meta?.start_date) {
    state.monitorStartDate = dashboard.meta.start_date;
  }
  if (dashboard?.meta?.end_date) {
    state.monitorEndDate = dashboard.meta.end_date;
  }
  persistRange("monitor");
  renderMonitorDashboard();
}

async function loadPlatformDashboard() {
  const dashboard = await fetchDashboard(state.platformStartDate, state.platformEndDate, state.platformAudience);
  state.platformDashboard = dashboard;
  if (dashboard?.meta?.start_date) {
    state.platformStartDate = dashboard.meta.start_date;
  }
  if (dashboard?.meta?.end_date) {
    state.platformEndDate = dashboard.meta.end_date;
  }
  persistRange("platform");
  renderPlatformDashboard();
}

async function loadAgentDashboard() {
  const dashboard = await fetchDashboard(state.agentStartDate, state.agentEndDate, state.agentAudience, { includeAgentRounds: true });
  state.agentDashboard = dashboard;
  state.agentUserPage = 1;
  state.agentSessionPage = 1;
  if (dashboard?.meta?.start_date) {
    state.agentStartDate = dashboard.meta.start_date;
  }
  if (dashboard?.meta?.end_date) {
    state.agentEndDate = dashboard.meta.end_date;
  }
  persistRange("agent");
  renderAgentDashboard();
}

async function loadAllDashboards() {
  await Promise.all([loadMonitorDashboard(), loadPlatformDashboard(), loadAgentDashboard()]);
}

async function loadUserActivity() {
  if (!state.users.length) return;
  const params = new URLSearchParams();
  for (const user of state.users) {
    params.append("user_ids", String(user.id));
  }
  const data = await request(`/api/reports/user-activity?${params.toString()}`, {
    headers: authHeaders(),
  });
  const metrics = new Map((data.data || []).map((item) => [String(item.user_id), item]));
  state.users = state.users.map((user) => {
    const metric = metrics.get(String(user.id));
    return {
      ...user,
      activity_count: metric?.activity_count ?? 0,
      session_count: metric?.session_count ?? 0,
      last_active_at: metric?.last_active_at ?? null,
    };
  });
}

function openDialog(user = null) {
  els.formError.textContent = "";
  els.userForm.reset();
  const isEdit = Boolean(user);
  els.dialogTitle.textContent = isEdit ? "编辑用户" : "新增用户";
  els.userForm.dataset.mode = isEdit ? "edit" : "create";

  const passwordInput = els.userForm.elements.password;
  passwordInput.required = !isEdit;
  passwordInput.placeholder = isEdit ? "留空则不修改" : "";

  if (isEdit) {
    for (const [key, value] of Object.entries(user)) {
      const input = els.userForm.elements[key];
      if (!input) continue;
      if (input.type === "datetime-local") {
        input.value = toDateTimeLocal(value);
      } else if (input.type === "checkbox") {
        input.checked = Boolean(value);
      } else if (value !== null && value !== undefined) {
        input.value = value;
      }
    }
  } else {
    els.userForm.elements.permissions.value = "research";
    els.userForm.elements.deleted.checked = false;
  }

  els.userDialog.showModal();
  iconRefresh();
}

async function submitUserForm(event) {
  event.preventDefault();
  els.formError.textContent = "";
  const mode = els.userForm.dataset.mode;
  const formData = new FormData(els.userForm);
  try {
    const payload = cleanPayload(formData, mode);
    const id = formData.get("id");
    if (mode === "edit") {
      await request(`/api/users/${id}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      showToast("用户已更新");
    } else {
      await request("/api/users", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      showToast("用户已创建");
    }
    els.userDialog.close();
      await Promise.all([loadAllDashboards(), loadUsers()]);
  } catch (err) {
    els.formError.textContent = err.message;
  }
}

async function deleteUser(id) {
  const user = state.users.find((item) => String(item.id) === String(id));
  const label = user ? `${user.username} (${user.email || "-"})` : `ID ${id}`;
  if (!confirm(`确认删除 ${label}？`)) return;
  await request(`/api/users/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  showToast("用户已删除");
  await Promise.all([loadAllDashboards(), loadUsers()]);
}

function resetBatchDialog() {
  const now = new Date();
  state.batchUsers = [];
  els.batchForm.reset();
  els.batchForm.elements.subscribe_start_at.value = toDateTimeLocal(now);
  els.batchForm.elements.subscribe_end_at.value = toDateTimeLocal(addMonths(now, 1));
  els.batchError.textContent = "";
  els.batchPreviewSection.classList.add("hidden");
  els.batchResultSection.classList.add("hidden");
  els.batchFailureWrap.classList.add("hidden");
  els.batchPreviewBody.innerHTML = "";
  els.batchFailureBody.innerHTML = "";
  els.confirmBatchButton.disabled = true;
}

function openBatchDialog() {
  resetBatchDialog();
  els.batchForm.elements.permissions.value = "research";
  els.batchDialog.showModal();
  iconRefresh();
}

function renderBatchPreview() {
  els.batchPreviewSummary.textContent = `${state.batchUsers.length} 个待新增用户`;
  els.batchPreviewBody.innerHTML = state.batchUsers
    .map(
      (user) => `
        <tr>
          <td>${escapeHtml(user.username)}</td>
          <td>${escapeHtml(user.email)}</td>
          <td>${displayValue(user.organization_name)}</td>
          <td><span class="badge">${displayValue(user.permissions)}</span></td>
          <td>${displayDate(user.subscribe_start_at)}</td>
          <td>${displayDate(user.subscribe_end_at)}</td>
          <td><code>${escapeHtml(user.password)}</code></td>
        </tr>
      `
    )
    .join("");
  els.batchPreviewSection.classList.remove("hidden");
  els.confirmBatchButton.disabled = state.batchUsers.length === 0;
}

function renderBatchResult(result) {
  const failed = result.failed || [];
  els.batchResultSummary.textContent = `已插入 ${result.created || 0} 个用户，已发送 ${result.emailed || 0} 封邮件`;
  els.batchFailureSummary.textContent = failed.length ? `${failed.length} 个用户失败` : "无失败用户";
  els.batchFailureWrap.classList.toggle("hidden", failed.length === 0);
  els.batchFailureBody.innerHTML = failed
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.email)}</td>
          <td>${displayValue(item.username)}</td>
          <td>${item.stage === "insert" ? "插入" : "邮件"}</td>
          <td>${escapeHtml(item.reason)}</td>
        </tr>
      `
    )
    .join("");
  els.batchResultSection.classList.remove("hidden");
}

async function previewBatchUsers(event) {
  event.preventDefault();
  els.batchError.textContent = "";
  els.batchResultSection.classList.add("hidden");
  els.previewBatchButton.disabled = true;
  els.confirmBatchButton.disabled = true;

  const formData = new FormData(els.batchForm);
  try {
    const data = await request("/api/users/batch/preview", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        emails: formData.get("emails"),
        organization_name: String(formData.get("organization_name") || "").trim() || null,
        permissions: formData.get("permissions"),
        subscribe_start_at: fromDateTimeLocal(formData.get("subscribe_start_at")),
        subscribe_end_at: fromDateTimeLocal(formData.get("subscribe_end_at")),
      }),
    });
    state.batchUsers = data.data || [];
    renderBatchPreview();
  } catch (err) {
    state.batchUsers = [];
    els.batchPreviewSection.classList.add("hidden");
    els.batchError.textContent = err.message;
  } finally {
    els.previewBatchButton.disabled = false;
  }
}

async function confirmBatchUsers() {
  if (!state.batchUsers.length) return;
  els.batchError.textContent = "";
  els.confirmBatchButton.disabled = true;
  try {
    const result = await request("/api/users/batch/create-send", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ users: state.batchUsers }),
    });
    renderBatchResult(result);
    state.batchUsers = [];
    els.batchPreviewSection.classList.add("hidden");
    await Promise.all([loadAllDashboards(), loadUsers()]);
    showToast("批量新增执行完成");
  } catch (err) {
    els.batchError.textContent = err.message;
  } finally {
    els.confirmBatchButton.disabled = state.batchUsers.length === 0;
  }
}

function openMailDialog(user, tempPassword) {
  state.pendingEmail = {
    id: user.id,
    username: user.username || user.email || `ID ${user.id}`,
    email: user.email || "",
    tempPassword,
  };
  els.mailError.textContent = "";
  els.mailUserLabel.textContent = `${state.pendingEmail.username} (${state.pendingEmail.email || "-"})`;
  els.mailPassword.textContent = tempPassword;
  els.mailDialog.showModal();
  iconRefresh();
}

async function prepareUserEmail(id, button) {
  const user = state.users.find((item) => String(item.id) === String(id));

  button.disabled = true;
  try {
    const data = await request(`/api/users/${id}/generate-password`, {
      method: "POST",
      headers: authHeaders(),
    });
    openMailDialog(user || { id, username: "", email: "" }, data.temp_password);
  } catch (err) {
    showToast(err.message);
  } finally {
    button.disabled = false;
  }
}

async function confirmSendUserEmail() {
  if (!state.pendingEmail) return;

  els.mailError.textContent = "";
  els.confirmMailDialog.disabled = true;
  try {
    await request(`/api/users/${state.pendingEmail.id}/send-email`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ temp_password: state.pendingEmail.tempPassword }),
    });
    els.mailDialog.close();
    state.pendingEmail = null;
    showToast("临时密码邮件已发送");
    await loadUsers();
  } catch (err) {
    els.mailError.textContent = err.message;
  } finally {
    els.confirmMailDialog.disabled = false;
  }
}

async function copyMailPassword() {
  if (!state.pendingEmail) return;
  try {
    await navigator.clipboard.writeText(state.pendingEmail.tempPassword);
    showToast("密码已复制");
  } catch {
    showToast("复制失败，请手动复制");
  }
}

function parseRecipientEmails(value) {
  const emails = [];
  const seen = new Set();
  for (const part of value.split(/[\s,;，]+/)) {
    const email = part.trim();
    if (!email) continue;
    const normalized = email.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    emails.push(email);
  }
  if (!emails.length) {
    throw new Error("请填写至少一个收件人邮箱");
  }
  return emails;
}

async function openReportDialog() {
  els.reportError.textContent = "";
  els.reportRecipients.value = "加载中...";
  els.reportRecipients.disabled = true;
  els.confirmReportDialog.disabled = false;
  els.confirmReportDialog.innerHTML = '<i data-lucide="send"></i>确认发送';
  els.reportDialog.showModal();
  iconRefresh();
  try {
    const data = await request("/api/reports/user-permissions/recipients", {
      headers: authHeaders(),
    });
    els.reportRecipients.value = (data.recipients || []).join(", ");
  } catch (err) {
    els.reportRecipients.value = "";
    els.reportError.textContent = err.message;
  } finally {
    els.reportRecipients.disabled = false;
  }
}

async function confirmSendReport() {
  els.reportError.textContent = "";
  let recipients;
  try {
    recipients = parseRecipientEmails(els.reportRecipients.value);
  } catch (err) {
    els.reportError.textContent = err.message;
    return;
  }
  els.confirmReportDialog.disabled = true;
  els.confirmReportDialog.innerHTML = '<i data-lucide="loader-circle"></i>发送中';
  iconRefresh();
  try {
    await request("/api/reports/user-permissions/send", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ recipients }),
    });
    els.reportDialog.close();
    showToast("统计报告邮件已发送");
  } catch (err) {
    els.reportError.textContent = err.message;
  } finally {
    els.confirmReportDialog.disabled = false;
    els.confirmReportDialog.innerHTML = '<i data-lucide="send"></i>确认发送';
    iconRefresh();
  }
}

async function bootstrap() {
  ensureRange("monitor");
  ensureRange("platform");
  ensureRange("agent");
  renderTableHeader();
  renderColumnMenu();
  iconRefresh();
  if (!state.token) {
    showLogin();
    return;
  }
  try {
    const me = await request("/api/auth/me", { headers: authHeaders() });
    showAdmin(me);
    await Promise.all([loadAllDashboards(), loadUsers()]);
  } catch {
    showLogin();
  }
}

els.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  els.loginError.textContent = "";
  const formData = new FormData(els.loginForm);
  try {
    const data = await request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: formData.get("username"),
        password: formData.get("password"),
      }),
    });
    state.token = data.access_token;
    localStorage.setItem("mu_user_management_token", state.token);
    showAdmin(data);
    await Promise.all([loadAllDashboards(), loadUsers()]);
  } catch (err) {
    els.loginError.textContent = err.message;
  }
});

els.logoutButton.addEventListener("click", () => logout(true));
els.monitorNav.addEventListener("click", () => switchView("monitor"));
els.platformNav.addEventListener("click", () => switchView("platform"));
els.agentNav.addEventListener("click", () => switchView("agent"));
els.managementNav.addEventListener("click", () => switchView("management"));
els.monitorRangeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  state.monitorStartDate = els.monitorStartDate.value;
  state.monitorEndDate = els.monitorEndDate.value;
  state.monitorAudience = els.monitorAudience.value;
  persistRange("monitor");
  await loadMonitorDashboard();
});
els.resetMonitorRange.addEventListener("click", async () => {
  ensureRange("monitor", true);
  state.monitorAudience = "all";
  ensureRange("monitor");
  persistRange("monitor");
  await loadMonitorDashboard();
});
if (els.platformRangeForm) {
  els.platformRangeForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    state.platformStartDate = els.platformStartDate.value;
    state.platformEndDate = els.platformEndDate.value;
    state.platformAudience = els.platformAudience.value;
    persistRange("platform");
    await loadPlatformDashboard();
  });
}
if (els.resetPlatformRange) {
  els.resetPlatformRange.addEventListener("click", async () => {
    ensureRange("platform", true);
    state.platformAudience = "all";
    ensureRange("platform");
    persistRange("platform");
    await loadPlatformDashboard();
  });
}
if (els.agentRangeForm) {
  els.agentRangeForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    state.agentStartDate = els.agentStartDate.value;
    state.agentEndDate = els.agentEndDate.value;
    state.agentAudience = els.agentAudience.value;
    persistRange("agent");
    await loadAgentDashboard();
  });
}
if (els.resetAgentRange) {
  els.resetAgentRange.addEventListener("click", async () => {
    ensureRange("agent", true);
    state.agentAudience = "all";
    ensureRange("agent");
    persistRange("agent");
    await loadAgentDashboard();
  });
}
els.sendReportButton.addEventListener("click", openReportDialog);

els.filterForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(els.filterForm);
  state.filters = Object.fromEntries(formData.entries());
  state.page = 1;
  await loadUsers();
});

els.batchCreateButton.addEventListener("click", openBatchDialog);
els.createButton.addEventListener("click", () => openDialog());
els.closeDialog.addEventListener("click", () => els.userDialog.close());
els.cancelDialog.addEventListener("click", () => els.userDialog.close());
els.userForm.addEventListener("submit", submitUserForm);
els.closeBatchDialog.addEventListener("click", () => els.batchDialog.close());
els.cancelBatchDialog.addEventListener("click", () => els.batchDialog.close());
els.batchForm.addEventListener("submit", previewBatchUsers);
els.confirmBatchButton.addEventListener("click", confirmBatchUsers);
els.closeMailDialog.addEventListener("click", () => els.mailDialog.close());
els.cancelMailDialog.addEventListener("click", () => els.mailDialog.close());
els.confirmMailDialog.addEventListener("click", confirmSendUserEmail);
els.copyMailPassword.addEventListener("click", copyMailPassword);
els.mailDialog.addEventListener("close", () => {
  state.pendingEmail = null;
  els.mailError.textContent = "";
});
els.closeReportDialog.addEventListener("click", () => els.reportDialog.close());
els.closeFeatureTrendDialog?.addEventListener("click", () => els.featureTrendDialog.close());
els.agentUserPrev?.addEventListener("click", () => {
  state.agentUserPage -= 1;
  renderAgentDashboard();
});
els.agentUserNext?.addEventListener("click", () => {
  state.agentUserPage += 1;
  renderAgentDashboard();
});
els.agentSessionPrev?.addEventListener("click", () => {
  state.agentSessionPage -= 1;
  renderAgentDashboard();
});
els.agentSessionNext?.addEventListener("click", () => {
  state.agentSessionPage += 1;
  renderAgentDashboard();
});
els.agentStickyUserPrev?.addEventListener("click", () => {
  state.agentStickyUserPage -= 1;
  renderAgentDashboard();
});
els.agentStickyUserNext?.addEventListener("click", () => {
  state.agentStickyUserPage += 1;
  renderAgentDashboard();
});
els.monitorEndpointPrev?.addEventListener("click", () => {
  state.monitorEndpointPage -= 1;
  renderMonitorDashboard();
});
els.monitorEndpointNext?.addEventListener("click", () => {
  state.monitorEndpointPage += 1;
  renderMonitorDashboard();
});
els.monitorUserPrev?.addEventListener("click", () => {
  state.monitorUserPage -= 1;
  renderMonitorDashboard();
});
els.monitorUserNext?.addEventListener("click", () => {
  state.monitorUserPage += 1;
  renderMonitorDashboard();
});
els.cancelReportDialog.addEventListener("click", () => els.reportDialog.close());
els.confirmReportDialog.addEventListener("click", confirmSendReport);
els.reportDialog.addEventListener("close", () => {
  els.reportError.textContent = "";
});

els.userTableHeader.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-sort-key]");
  if (!button) return;
  const sortKey = button.dataset.sortKey;
  if (state.sortBy === sortKey) {
    state.sortOrder = state.sortOrder === "asc" ? "desc" : "asc";
  } else {
    state.sortBy = sortKey;
    state.sortOrder = "asc";
  }
  state.page = 1;
  await loadUsers();
});

els.columnButton.addEventListener("click", () => {
  els.columnMenu.classList.toggle("hidden");
});

els.columnMenu.addEventListener("change", (event) => {
  if (event.target.type !== "checkbox") return;
  const checked = Array.from(els.columnMenu.querySelectorAll("input:checked")).map((input) => input.value);
  if (!checked.length) {
    event.target.checked = true;
    showToast("至少保留一列");
    return;
  }
  state.visibleColumns = checked;
  localStorage.setItem(columnStorageKey, JSON.stringify(state.visibleColumns));
  renderTableHeader();
  renderTable();
});

document.addEventListener("click", (event) => {
  if (els.columnMenu.classList.contains("hidden")) return;
  if (event.target.closest(".column-picker")) return;
  els.columnMenu.classList.add("hidden");
});

els.prevPage.addEventListener("click", async () => {
  if (state.page <= 1) return;
  state.page -= 1;
  await loadUsers();
});

els.nextPage.addEventListener("click", async () => {
  const totalPages = Math.max(1, Math.ceil(state.total / state.pageSize));
  if (state.page >= totalPages) return;
  state.page += 1;
  await loadUsers();
});

els.userTableBody.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const id = button.dataset.id;
  if (button.dataset.action === "edit") {
    const user = await request(`/api/users/${id}`, { headers: authHeaders() });
    openDialog(user);
  }
  if (button.dataset.action === "send-email") {
    await prepareUserEmail(id, button);
  }
  if (button.dataset.action === "delete") {
    await deleteUser(id);
  }
});

bootstrap();
