"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface UserInfo {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

interface Stats {
  reportCount: number;
  dataSourceCount: number;
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  // 修改名称
  const [editName, setEditName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // 修改密码
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        setUser(data.user);
        setStats(data.stats);
        setEditName(data.user.name);
      })
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingName(true);
    setNameMsg(null);

    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName }),
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setNameMsg({ type: "success", text: "名称已更新" });
      } else {
        const data = await res.json();
        setNameMsg({ type: "error", text: data.error || "更新失败" });
      }
    } catch {
      setNameMsg({ type: "error", text: "网络错误" });
    } finally {
      setSavingName(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPassword(true);
    setPwdMsg(null);

    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword, newPassword }),
      });

      if (res.ok) {
        setPwdMsg({ type: "success", text: "密码已更新" });
        setOldPassword("");
        setNewPassword("");
      } else {
        const data = await res.json();
        setPwdMsg({ type: "error", text: data.error || "更新失败" });
      }
    } catch {
      setPwdMsg({ type: "error", text: "网络错误" });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  if (loading) {
    return (
      <div className="text-center py-12 text-gray-500">加载中...</div>
    );
  }

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">个人中心</h1>

      {/* 用户信息 + 统计 */}
      <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xl font-bold text-blue-600 dark:text-blue-300">
            {user.name[0]?.toUpperCase()}
          </div>
          <div>
            <div className="font-medium text-lg">{user.name}</div>
            <div className="text-sm text-gray-500">{user.email}</div>
            <div className="text-xs text-gray-400 mt-0.5">
              注册于 {new Date(user.createdAt).toLocaleDateString("zh-CN")}
            </div>
          </div>
        </div>
        {stats && (
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 text-center">
              <div className="text-2xl font-bold">{stats.reportCount}</div>
              <div className="text-xs text-gray-500">报告数</div>
            </div>
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 text-center">
              <div className="text-2xl font-bold">{stats.dataSourceCount}</div>
              <div className="text-xs text-gray-500">已连接数据源</div>
            </div>
          </div>
        )}
      </section>

      {/* 修改名称 */}
      <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <h2 className="text-lg font-semibold mb-4">修改名称</h2>
        {nameMsg && (
          <div
            className={`mb-3 p-2 rounded text-sm ${
              nameMsg.type === "success"
                ? "bg-green-50 text-green-600"
                : "bg-red-50 text-red-600"
            }`}
          >
            {nameMsg.text}
          </div>
        )}
        <form onSubmit={handleUpdateName} className="flex gap-2">
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <button
            type="submit"
            disabled={savingName}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm font-medium"
          >
            {savingName ? "保存中..." : "保存"}
          </button>
        </form>
      </section>

      {/* 修改密码 */}
      <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <h2 className="text-lg font-semibold mb-4">修改密码</h2>
        {pwdMsg && (
          <div
            className={`mb-3 p-2 rounded text-sm ${
              pwdMsg.type === "success"
                ? "bg-green-50 text-green-600"
                : "bg-red-50 text-red-600"
            }`}
          >
            {pwdMsg.text}
          </div>
        )}
        <form onSubmit={handleChangePassword} className="space-y-3">
          <div>
            <label className="block text-sm mb-1">旧密码</label>
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">新密码（至少 6 位）</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={savingPassword}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm font-medium"
          >
            {savingPassword ? "更新中..." : "更新密码"}
          </button>
        </form>
      </section>

      {/* 登出 */}
      <section className="text-center">
        <button
          onClick={handleLogout}
          className="px-6 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition-colors text-sm font-medium"
        >
          退出登录
        </button>
      </section>
    </div>
  );
}
