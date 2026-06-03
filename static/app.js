const state = {
  token: localStorage.getItem("mu_user_management_token") || "",
  page: 1,
  pageSize: 20,
  total: 0,
  filters: {},
  users: [],
  pendingEmail: null,
  batchUsers: [],
};

const els = {
  loginView: document.querySelector("#loginView"),
  adminView: document.querySelector("#adminView"),
  loginForm: document.querySelector("#loginForm"),
  loginError: document.querySelector("#loginError"),
  adminName: document.querySelector("#adminName"),
  sendReportButton: document.querySelector("#sendReportButton"),
  logoutButton: document.querySelector("#logoutButton"),
  filterForm: document.querySelector("#filterForm"),
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
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(data.detail || "请求失败");
  }
  return data;
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
  iconRefresh();
}

function showLogin() {
  els.adminView.classList.add("hidden");
  els.loginView.classList.remove("hidden");
  iconRefresh();
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
  renderTableHeader();
  renderTable();
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
    await loadUsers();
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
  await loadUsers();
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
    await loadUsers();
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
    await loadUsers();
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
    await loadUsers();
  } catch (err) {
    els.loginError.textContent = err.message;
  }
});

els.logoutButton.addEventListener("click", () => logout(true));
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
