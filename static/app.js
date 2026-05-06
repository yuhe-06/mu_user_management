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
    if (value === "") continue;
    payload[key] = value;
  }
  if (mode === "create" && !payload.password) {
    throw new Error("新增用户需要填写密码");
  }
  return payload;
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
          <td>${user.id}</td>
          <td>${escapeHtml(user.username || "-")}</td>
          <td>${escapeHtml(user.email || "-")}</td>
          <td class="cell-muted">${escapeHtml(user.organization_name || "-")}</td>
          <td><span class="badge">${escapeHtml(user.permissions || "-")}</span></td>
          <td>${formatDate(user.created_at)}</td>
          <td>${formatDate(user.updated_at)}</td>
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
  });
  for (const [key, value] of Object.entries(state.filters)) {
    if (value) params.set(key, value);
  }
  const data = await request(`/api/users?${params.toString()}`, {
    headers: authHeaders(),
  });
  state.total = data.total;
  state.users = data.data;
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
      } else if (value !== null && value !== undefined) {
        input.value = value;
      }
    }
  } else {
    els.userForm.elements.permissions.value = "research";
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
