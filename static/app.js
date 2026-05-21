const state = {
  token: localStorage.getItem("mu_user_management_token") || "",
  page: 1,
  pageSize: 20,
  total: 0,
  filters: {},
  users: [],
};

const els = {
  loginView: document.querySelector("#loginView"),
  adminView: document.querySelector("#adminView"),
  loginForm: document.querySelector("#loginForm"),
  loginError: document.querySelector("#loginError"),
  adminName: document.querySelector("#adminName"),
  logoutButton: document.querySelector("#logoutButton"),
  filterForm: document.querySelector("#filterForm"),
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

els.filterForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(els.filterForm);
  state.filters = Object.fromEntries(formData.entries());
  state.page = 1;
  await loadUsers();
});

els.createButton.addEventListener("click", () => openDialog());
els.closeDialog.addEventListener("click", () => els.userDialog.close());
els.cancelDialog.addEventListener("click", () => els.userDialog.close());
els.userForm.addEventListener("submit", submitUserForm);

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
  if (button.dataset.action === "delete") {
    await deleteUser(id);
  }
});

bootstrap();
