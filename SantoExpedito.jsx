import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  Wrench, Package, Users, Shield, LogOut, Plus, Edit2, Trash2,
  AlertTriangle, CheckCircle, X, Eye, EyeOff, Lock, User, Home, Search,
  RefreshCw, ChevronRight, Key, UserPlus, Menu, AlertCircle,
  Barcode, ScanLine, ShoppingCart, Cross, Receipt, Minus, DollarSign, Boxes,
  Banknote, CreditCard, QrCode
} from "lucide-react";

// ── Utilitários ───────────────────────────────────────────────────────────────
const fmtDate = d => d ? new Date(d).toLocaleDateString("pt-BR") : "—";
const fmtDT   = d => d ? new Date(d).toLocaleString("pt-BR")      : "—";
const fmtCur  = v => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const nowISO  = () => new Date().toISOString();
const uid     = () => Date.now() + Math.random();
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

// ── Constantes ────────────────────────────────────────────────────────────────
const ROLES = ["Administrador", "Estoquista", "Atendente"];
const MAX_FAIL = 5;
const PAGAMENTOS = [
  { id: "Dinheiro", icon: Banknote },
  { id: "PIX",      icon: QrCode },
  { id: "Débito",   icon: CreditCard },
  { id: "Crédito",  icon: CreditCard },
];
const NAV = [
  { id: "dashboard", label: "Dashboard",          icon: Home,         allow: ["Administrador"] },
  { id: "vendas",    label: "Vendas Diárias",     icon: ShoppingCart, allow: ["Administrador","Atendente"] },
  { id: "estoque",   label: "Estoque & Produtos", icon: Package,      allow: ["Administrador","Estoquista","Atendente"] },
  { id: "usuarios",  label: "Usuários",           icon: Users,        allow: ["Administrador"] },
  { id: "auditoria", label: "Auditoria",          icon: Shield,       allow: ["Administrador"] },
];

// ── Micro-components ──────────────────────────────────────────────────────────
const Badge = ({ color, label }) => {
  const C = {
    green:"bg-emerald-100 text-emerald-700", red:"bg-red-100 text-red-700",
    blue:"bg-blue-100 text-blue-700", amber:"bg-amber-100 text-amber-700",
    slate:"bg-slate-100 text-slate-600",
  };
  return <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${C[color] || C.slate}`}>{label}</span>;
};

const StatCard = ({ icon: I, label, value, sub, color = "red" }) => {
  const C = { red:"bg-red-600", green:"bg-emerald-500", blue:"bg-blue-500", amber:"bg-amber-500", slate:"bg-slate-500" };
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 flex items-start gap-4">
      <div className={`${C[color] || C.red} p-3 rounded-xl text-white shrink-0`}><I size={20} /></div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide truncate">{label}</p>
        <p className="text-2xl font-bold text-slate-800 mt-0.5 truncate">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
};

const ModalWrap = ({ title, onClose, children, wide = false }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-black/50" onClick={onClose} />
    <div className={`relative bg-white rounded-2xl shadow-2xl ${wide ? "w-full max-w-2xl" : "w-full max-w-md"} max-h-[90vh] flex flex-col`}>
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
        <h2 className="font-bold text-slate-800">{title}</h2>
        <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"><X size={18} /></button>
      </div>
      <div className="overflow-y-auto flex-1 p-6">{children}</div>
    </div>
  </div>
);

const Fld = ({ label, children }) => (
  <div><label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">{label}</label>{children}</div>
);
const Inp = ({ className = "", ...p }) => (
  <input className={`w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400 bg-white transition-colors ${className}`} {...p} />
);
const Sel = ({ children, ...p }) => (
  <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400 bg-white transition-colors" {...p}>{children}</select>
);
const BtnPrimary = ({ onClick, icon: I, children, className = "" }) => (
  <button onClick={onClick} className={`flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors ${className}`}>
    {I && <I size={14} />}{children}
  </button>
);
const BtnOutline = ({ onClick, icon: I, children }) => (
  <button onClick={onClick} className="flex items-center gap-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
    {I && <I size={14} />}{children}
  </button>
);

const Th = ({ children }) => <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">{children}</th>;
const Td = ({ children, className = "" }) => <td className={`px-4 py-3 text-sm ${className}`}>{children}</td>;

// ── Logo do Santo Expedito (emblema cruz) ─────────────────────────────────────
const Emblema = ({ size = 22 }) => (
  <div className="bg-red-600 rounded-xl flex items-center justify-center shadow-md" style={{ width: size * 1.9, height: size * 1.9 }}>
    <Cross size={size} className="text-white" strokeWidth={2.5} />
  </div>
);

// ── App Principal ─────────────────────────────────────────────────────────────
export default function App() {
  const [users,       setUsers]       = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersErr,    setUsersErr]    = useState("");
  const [pecas,  setPecas]  = useState([]);
  const [pecasLoading, setPecasLoading] = useState(false);
  const [pecasErr,     setPecasErr]     = useState("");
  const [vendas, setVendas] = useState([]);
  const [vendasLoading, setVendasLoading] = useState(false);
  const [vendasErr,     setVendasErr]     = useState("");
  const [log,       setLog]       = useState([]);
  const [logLoading, setLogLoading] = useState(false);
  const [logErr,     setLogErr]     = useState("");
  const [sess,   setSess]   = useState(null);
  const [sessChecked, setSessChecked] = useState(false);
  const [mod,    setMod]    = useState("dashboard");
  const [sbar,   setSbar]   = useState(true);
  const [modal,  setModal]  = useState(null);
  const [mf,     setMf]     = useState({});
  const [search, setSearch] = useState("");
  const [lf,     setLf]     = useState({ login: "", senha: "" });
  const [lErr,   setLErr]   = useState("");
  const [showP,  setShowP]  = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);

  // Estados de leitura por código de barras
  const [bip,   setBip]   = useState({ cb: "", lista: [], last: null }); // entrada no estoque
  const [venda, setVenda] = useState({ cb: "", q: "", itens: [], pag: "Dinheiro", msg: null });  // caixa / venda
  const [vendaBusy, setVendaBusy] = useState(false);
  const bipRef   = useRef(null);
  const vendaRef = useRef(null);

  // Mantém o cursor pronto para o próximo bipe
  useEffect(() => { if (modal === "bipar") bipRef.current?.focus(); }, [modal, bip]);
  useEffect(() => { if (sess && mod === "vendas") vendaRef.current?.focus(); }, [sess, mod]);

  // Restaura a sessão (cookie) ao carregar a página
  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.user) setSess({ user: data.user, since: nowISO() });
      })
      .finally(() => setSessChecked(true));
  }, []);

  // ── Usuários (Neon, via /api/users) ──────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersErr("");
    try {
      const r = await fetch("/api/users");
      const data = await r.json();
      if (!r.ok) { setUsersErr(data.error || "Erro ao carregar usuários."); return; }
      setUsers(data.users);
    } catch {
      setUsersErr("Não foi possível contatar o servidor.");
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => { if (sess && mod === "usuarios") fetchUsers(); }, [sess, mod, fetchUsers]);

  // ── Auditoria (Neon, via /api/audit) ─────────────────────────────────────
  const fetchLog = useCallback(async () => {
    setLogLoading(true);
    setLogErr("");
    try {
      const r = await fetch("/api/audit");
      const data = await r.json();
      if (!r.ok) { setLogErr(data.error || "Erro ao carregar a auditoria."); return; }
      setLog(data.log);
    } catch {
      setLogErr("Não foi possível contatar o servidor.");
    } finally {
      setLogLoading(false);
    }
  }, []);

  useEffect(() => { if (sess && mod === "auditoria") fetchLog(); }, [sess, mod, fetchLog]);

  // ── Peças (Neon, via /api/pecas) ─────────────────────────────────────────
  const fetchPecas = useCallback(async () => {
    setPecasLoading(true);
    setPecasErr("");
    try {
      const r = await fetch("/api/pecas");
      const data = await r.json();
      if (!r.ok) { setPecasErr(data.error || "Erro ao carregar produtos."); return; }
      setPecas(data.pecas);
    } catch {
      setPecasErr("Não foi possível contatar o servidor.");
    } finally {
      setPecasLoading(false);
    }
  }, []);

  // Estoque é usado em Dashboard, Vendas e Estoque — carrega assim que a sessão abre.
  useEffect(() => { if (sess) fetchPecas(); }, [sess, fetchPecas]);

  // ── Vendas (Neon, via /api/vendas) ───────────────────────────────────────
  const fetchVendas = useCallback(async () => {
    setVendasLoading(true);
    setVendasErr("");
    try {
      const r = await fetch("/api/vendas");
      const data = await r.json();
      if (!r.ok) { setVendasErr(data.error || "Erro ao carregar vendas."); return; }
      setVendas(data.vendas);
    } catch {
      setVendasErr("Não foi possível contatar o servidor.");
    } finally {
      setVendasLoading(false);
    }
  }, []);

  useEffect(() => { if (sess) fetchVendas(); }, [sess, fetchVendas]);

  const stats = useMemo(() => {
    const hoje = vendas.filter(v => sameDay(v.data, nowISO()));
    return {
      produtos: pecas.length,
      al: pecas.filter(p => p.qtd <= p.min).length,
      valorEstoque: pecas.reduce((a, p) => a + p.preco * p.qtd, 0),
      unidades: pecas.reduce((a, p) => a + p.qtd, 0),
      vendasHoje: hoje.length,
      totalHoje: hoje.reduce((a, v) => a + v.total, 0),
      totalGeral: vendas.reduce((a, v) => a + v.total, 0),
    };
  }, [pecas, vendas]);

  // Busca produto pelo código de barras OU código interno
  const acharPeca = (code) => {
    const c = String(code || "").trim().toLowerCase();
    if (!c) return null;
    return pecas.find(p => (p.cb && p.cb.toLowerCase() === c) || p.codigo.toLowerCase() === c) || null;
  };

  // ── Autenticação ──────────────────────────────────────────────────────────
  const doLogin = async () => {
    setLoginBusy(true);
    setLErr("");
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: lf.login, senha: lf.senha }),
      });
      const data = await r.json();
      if (!r.ok) { setLErr(data.error || "Não foi possível entrar."); return; }
      const u = data.user;
      setSess({ user: u, since: nowISO() });
      setLf({ login: "", senha: "" });
      setMod(u.cargo === "Atendente" ? "vendas" : u.cargo === "Estoquista" ? "estoque" : "dashboard");
    } catch {
      setLErr("Não foi possível contatar o servidor.");
    } finally {
      setLoginBusy(false);
    }
  };

  const doLogout = () => {
    fetch("/api/auth/logout", { method: "POST" });
    setSess(null); setMod("dashboard");
  };

  // ── Verificando sessão existente (cookie) ────────────────────────────────
  if (!sessChecked) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <RefreshCw size={22} className="text-red-500 animate-spin" />
    </div>
  );

  // ── TELA DE LOGIN ─────────────────────────────────────────────────────────
  if (!sess) return (
    <div className="min-h-screen bg-white flex">
      {/* Painel esquerdo – Santo Expedito */}
      <div className="hidden lg:flex flex-col justify-between w-2/5 p-12 relative overflow-hidden"
        style={{ background: "linear-gradient(150deg,#7f1d1d 0%,#b91c1c 55%,#991b1b 100%)" }}>
        <div className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: "repeating-linear-gradient(0deg,#fff 0,#fff 1px,transparent 1px,transparent 34px),repeating-linear-gradient(90deg,#fff 0,#fff 1px,transparent 1px,transparent 34px)" }} />
        <div className="absolute -bottom-20 -right-10 opacity-10">
          <Cross size={280} className="text-white" strokeWidth={1.5} />
        </div>

        <div className="relative">
          <div className="flex items-center gap-3 mb-16">
            <div className="bg-white p-2.5 rounded-xl shadow-lg">
              <Cross size={22} className="text-red-700" strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-white font-bold leading-none">Santo Expedito</p>
              <p className="text-red-200 text-xs">Oficina & Borracharia</p>
            </div>
          </div>

          <p className="text-red-200 text-[11px] uppercase tracking-[0.25em] mb-3">Padroeiro das Causas Urgentes</p>
          <h1 className="text-6xl font-black text-white leading-none">Santo<br/>Expedito<span className="text-red-300">.</span></h1>
          <p className="text-red-100/90 text-lg font-light mt-6 leading-relaxed">Controle de estoque<br />e vendas da sua loja.</p>

          <div className="mt-12 space-y-3">
            {["Cadastro de produtos manual ou por bipe", "Entrada no estoque pela leitura", "Caixa com baixa automática na venda", "Usuários & Auditoria"].map(i => (
              <div key={i} className="flex items-center gap-3 text-red-100 text-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />{i}
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-red-300/70 text-xs">© 2025 Oficina Santo Expedito · v2.0</p>
      </div>

      {/* Formulário de login */}
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-10">
            <div className="bg-red-600 p-2 rounded-lg"><Cross size={16} className="text-white" /></div>
            <span className="text-slate-800 font-bold">Santo Expedito</span>
          </div>

          <h2 className="text-2xl font-bold text-slate-800 mb-1">Bem-vindo de volta</h2>
          <p className="text-slate-500 text-sm mb-8">Acesse com suas credenciais</p>

          <div className="space-y-4">
            <Fld label="Usuário ou e-mail">
              <div className="relative">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={lf.login}
                  onChange={e => { setLf(p => ({ ...p, login: e.target.value })); setLErr(""); }}
                  onKeyDown={e => e.key === "Enter" && doLogin()}
                  placeholder="seu.login ou seu@email.com"
                  autoCapitalize="none"
                  className="w-full bg-white border border-slate-200 text-slate-800 rounded-xl pl-9 pr-3 py-3 text-sm focus:outline-none focus:border-red-500 transition-colors placeholder-slate-400" />
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">Administradores entram com e-mail e senha.</p>
            </Fld>

            <Fld label="Senha">
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type={showP ? "text" : "password"} value={lf.senha}
                  onChange={e => { setLf(p => ({ ...p, senha: e.target.value })); setLErr(""); }}
                  onKeyDown={e => e.key === "Enter" && doLogin()}
                  placeholder="••••••••"
                  className="w-full bg-white border border-slate-200 text-slate-800 rounded-xl pl-9 pr-9 py-3 text-sm focus:outline-none focus:border-red-500 transition-colors placeholder-slate-400" />
                <button onClick={() => setShowP(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                  {showP ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </Fld>

            {lErr && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl p-3.5">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />{lErr}
              </div>
            )}

            <button onClick={doLogin} disabled={loginBusy}
              className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-semibold rounded-xl py-3 text-sm transition-colors shadow-lg shadow-red-200 mt-2">
              {loginBusy ? "Entrando..." : "Entrar no Sistema"}
            </button>
          </div>

          <p className="text-slate-400 text-xs text-center mt-5">
            Esqueceu a senha? Contate o Administrador do sistema.
          </p>
        </div>
      </div>
    </div>
  );

  // ── SISTEMA AUTENTICADO ───────────────────────────────────────────────────
  const isAdmin = sess.user.cargo === "Administrador";
  const visNav  = NAV.filter(n => n.allow.includes(sess.user.cargo));
  const curNav  = visNav.find(n => n.id === mod);
  const closeM  = () => setModal(null);
  const goMod   = (id) => { setMod(id); setSearch(""); };

  // ── Render: Dashboard ─────────────────────────────────────────────────────
  const renderDashboard = () => (
    <div className="space-y-5">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={ShoppingCart} label="Vendas hoje"      value={stats.vendasHoje}        color="red"   sub={fmtCur(stats.totalHoje)} />
        <StatCard icon={DollarSign}   label="Faturamento hoje"  value={fmtCur(stats.totalHoje)} color="green" sub="Total do dia" />
        <StatCard icon={Boxes}        label="Valor em Estoque"  value={fmtCur(stats.valorEstoque)} color="blue" sub={`${stats.produtos} produtos · ${stats.unidades} un`} />
        <StatCard icon={AlertTriangle} label="Alertas Estoque"  value={stats.al}                color="amber" sub="Abaixo do mínimo" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800">Últimas vendas</h3>
            {visNav.find(n => n.id === "vendas") &&
              <button onClick={() => goMod("vendas")} className="text-red-600 text-xs hover:underline font-medium">Ir ao caixa →</button>}
          </div>
          {vendas.length === 0
            ? <p className="text-slate-400 text-sm text-center py-6">Nenhuma venda registrada ainda</p>
            : vendas.slice(0, 5).map(v => (
              <div key={v.id} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                <div>
                  <p className="font-semibold text-slate-800 text-sm">{v.num}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{v.itens.reduce((a,i)=>a+i.qtd,0)} item(s) · {v.pag || "—"} · {fmtDT(v.data)}</p>
                </div>
                <span className="font-bold text-emerald-600 text-sm">{fmtCur(v.total)}</span>
              </div>
            ))}
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800">Alertas de Estoque</h3>
            <button onClick={() => goMod("estoque")} className="text-red-600 text-xs hover:underline font-medium">Gerenciar →</button>
          </div>
          {pecas.filter(p => p.qtd <= p.min).length === 0
            ? <p className="text-slate-400 text-sm text-center py-6">✓ Estoque regularizado</p>
            : pecas.filter(p => p.qtd <= p.min).map(p => (
              <div key={p.id} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                <div>
                  <p className="font-semibold text-slate-800 text-sm">{p.nome}</p>
                  <p className="text-xs text-slate-400">{p.cat}</p>
                </div>
                <div className="text-right">
                  <p className="text-red-600 font-bold text-sm">{p.qtd} un</p>
                  <p className="text-xs text-slate-400">mín: {p.min}</p>
                </div>
              </div>
            ))}
        </div>
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
        <h3 className="font-bold text-slate-800 mb-4">Faturamento por forma de pagamento (hoje)</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {PAGAMENTOS.map(({ id, icon: I }) => {
            const doDia = vendas.filter(v => sameDay(v.data, nowISO()) && (v.pag || "Dinheiro") === id);
            const t = doDia.reduce((a, v) => a + v.total, 0);
            return (
              <div key={id} className="rounded-xl border border-slate-100 p-4">
                <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1"><I size={14} className="text-red-500" />{id}</div>
                <p className="font-bold text-slate-800 text-lg">{fmtCur(t)}</p>
                <p className="text-[11px] text-slate-400">{doDia.length} venda(s)</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  // ── Render: Vendas Diárias — baixa automática na venda ────────────────────
  const addVendaItem = (peca) => {
    const noCarrinho = (venda.itens.find(i => i.id === peca.id)?.qtd) || 0;
    if (noCarrinho + 1 > peca.qtd) {
      setVenda(p => ({ ...p, msg: { ok: false, text: `Estoque insuficiente de ${peca.nome} (disponível: ${peca.qtd})` } }));
      return;
    }
    setVenda(p => {
      const itens = [...p.itens];
      const i = itens.findIndex(x => x.id === peca.id);
      if (i >= 0) itens[i] = { ...itens[i], qtd: itens[i].qtd + 1 };
      else itens.push({ id: peca.id, nome: peca.nome, codigo: peca.codigo, cb: peca.cb, preco: peca.preco, qtd: 1, tipo: "peca" });
      return { ...p, itens, msg: { ok: true, text: `${peca.nome} adicionado` } };
    });
  };

  const addServicoItem = () => {
    const nome = venda.servTipo;
    const desc = (venda.servDesc || "").trim();
    const valor = Number(venda.servValor);
    if (!nome) { setVenda(p => ({ ...p, msg: { ok: false, text: "Selecione Mão de obra ou Revisão." } })); return; }
    if (!valor || valor <= 0) { setVenda(p => ({ ...p, msg: { ok: false, text: "Informe um valor válido para o serviço." } })); return; }
    setVenda(p => ({
      ...p,
      itens: [...p.itens, { id: uid(), tipo: "servico", nome, descricao: desc, preco: valor, qtd: 1 }],
      servTipo: "", servDesc: "", servValor: "",
      msg: { ok: true, text: `${nome} adicionado` },
    }));
  };
  const lerVenda = () => {
    const code = String(venda.cb || "").trim();
    if (!code) return;
    const peca = acharPeca(code);
    if (!peca) {
      setVenda(p => ({ ...p, cb: "", msg: { ok: false, code, text: `Código "${code}" não cadastrado` } }));
      return;
    }
    addVendaItem(peca);
    setVenda(p => ({ ...p, cb: "" }));
  };

  const setVendaQtd = (id, q) => setVenda(p => {
    const peca = pecas.find(x => x.id === id);
    const max = peca ? peca.qtd : q;
    const novo = Math.min(Math.max(1, q), max);
    return { ...p, itens: p.itens.map(x => x.id === id ? { ...x, qtd: novo } : x) };
  });
  const removerVenda = id => setVenda(p => ({ ...p, itens: p.itens.filter(x => x.id !== id) }));

  const finalizarVenda = async () => {
    if (!venda.itens.length || vendaBusy) return;
    setVendaBusy(true);
    const pag = venda.pag || "Dinheiro";
    try {
      const r = await fetch("/api/vendas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itens: venda.itens.map(i => ({ id: i.id, tipo: i.tipo || "peca", nome: i.nome, descricao: i.descricao, preco: i.preco, qtd: i.qtd })),
          pag,
        }),
      });
      const data = await r.json();
      if (!r.ok) { setVenda(p => ({ ...p, msg: { ok: false, text: data.error || "Não foi possível finalizar a venda." } })); return; }
      const nova = data.venda;
      setVendas(p => [nova, ...p]);
      // Estoque foi baixado no servidor — recarrega para refletir as quantidades reais.
      fetchPecas();
      setVenda({ cb: "", q: "", itens: [], pag: "Dinheiro", msg: { ok: true, text: `Venda ${nova.num} concluída! ${fmtCur(nova.total)} (${pag})` } });
      setTimeout(() => vendaRef.current?.focus(), 0);
    } catch {
      setVenda(p => ({ ...p, msg: { ok: false, text: "Não foi possível contatar o servidor." } }));
    } finally {
      setVendaBusy(false);
    }
  };

  const renderVendas = () => {
    const total = venda.itens.reduce((a, i) => a + i.preco * i.qtd, 0);
    const qtdTotal = venda.itens.reduce((a, i) => a + i.qtd, 0);
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Coluna leitura + carrinho */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
              Bipe o produto para vender
            </label>
            <div className="relative">
              <ScanLine size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-red-500" />
              <input
                ref={vendaRef}
                value={venda.cb}
                onChange={e => setVenda(p => ({ ...p, cb: e.target.value }))}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); lerVenda(); } }}
                placeholder="Aguardando leitura..."
                className="w-full border-2 border-red-300 rounded-xl pl-11 pr-3 py-3.5 text-base font-mono focus:outline-none focus:border-red-500 bg-red-50/40 transition-colors" />
            </div>
            {venda.msg && (
              <div className={`mt-3 flex items-center justify-between gap-2 text-sm rounded-xl px-3.5 py-2.5 ${
                venda.msg.ok ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
                <span className="flex items-center gap-2">
                  {venda.msg.ok ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
                  <span className="font-medium">{venda.msg.text}</span>
                </span>
                {venda.msg.code && (
                  <button onClick={() => { setMf({ codigo:"", cb:venda.msg.code, nome:"", cat:"", custo:"", preco:"", qtd:"", min:"", forn:"" }); setModal("nova_peca"); }}
                    className="text-xs font-semibold underline shrink-0 hover:opacity-80">Cadastrar</button>
                )}
              </div>
            )}

            {/* Busca manual — quando o produto não tem código de barras */}
            <div className="mt-4 pt-4 border-t border-slate-100">
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                Sem código de barras? Busque o produto
              </label>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={venda.q || ""} onChange={e => setVenda(p => ({ ...p, q: e.target.value }))}
                  placeholder="Nome ou código do produto"
                  className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-red-400 bg-white transition-colors" />
              </div>
              {venda.q && (() => {
                const achados = pecas.filter(p =>
                  p.nome.toLowerCase().includes(venda.q.toLowerCase()) ||
                  p.codigo.toLowerCase().includes(venda.q.toLowerCase())
                ).slice(0, 8);
                return (
                  <div className="mt-2 border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-50 max-h-56 overflow-y-auto">
                    {achados.length === 0
                      ? <p className="px-3 py-3 text-xs text-slate-400">Nenhum produto encontrado.</p>
                      : achados.map(p => (
                        <button key={p.id} onClick={() => addVendaItem(p)} disabled={p.qtd <= 0}
                          className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-red-50/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-slate-800 truncate">{p.nome}</span>
                            <span className="block text-[11px] text-slate-400 font-mono">{p.codigo} · estoque: {p.qtd}{p.qtd <= 0 ? " (sem estoque)" : ""}</span>
                          </span>
                          <Plus size={16} className="text-red-500 shrink-0" />
                        </button>
                      ))}
                  </div>
                );
              })()}
            </div>

            {/* Serviços — mão de obra / revisão, sem baixa de estoque */}
            <div className="mt-4 pt-4 border-t border-slate-100">
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                Mão de obra / Revisão
              </label>
              <div className="flex gap-2 mb-2">
                <button type="button" onClick={() => setVenda(p => ({ ...p, servTipo: "Mão de obra" }))}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                    venda.servTipo === "Mão de obra"
                      ? "bg-red-600 border-red-600 text-white"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                  <Wrench size={13} />Mão de obra
                </button>
                <button type="button" onClick={() => setVenda(p => ({ ...p, servTipo: "Revisão" }))}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                    venda.servTipo === "Revisão"
                      ? "bg-red-600 border-red-600 text-white"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                  <RefreshCw size={13} />Revisão
                </button>
              </div>
              <div className="flex gap-2">
                <input value={venda.servDesc || ""} onChange={e => setVenda(p => ({ ...p, servDesc: e.target.value }))}
                  placeholder="Descrição (opcional)"
                  className="flex-1 min-w-0 border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-red-400 bg-white transition-colors" />
                <input type="number" min="0" step="0.01" value={venda.servValor || ""}
                  onChange={e => setVenda(p => ({ ...p, servValor: e.target.value }))}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addServicoItem(); } }}
                  placeholder="Valor"
                  className="w-28 shrink-0 border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-red-400 bg-white transition-colors" />
                <button type="button" onClick={addServicoItem}
                  className="shrink-0 bg-red-600 hover:bg-red-700 text-white rounded-lg px-3.5 transition-colors flex items-center justify-center">
                  <Plus size={16} />
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between bg-slate-50 px-4 py-3 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-2"><ShoppingCart size={14}/>Carrinho</span>
              <span className="text-xs font-semibold text-slate-600">{qtdTotal} item(s)</span>
            </div>
            {venda.itens.length === 0
              ? <p className="text-center text-slate-400 text-sm py-12">Bipe o primeiro produto para iniciar a venda.</p>
              : <div className="divide-y divide-slate-50 max-h-[46vh] overflow-y-auto">
                  {venda.itens.map(i => (
                    <div key={i.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-800 truncate flex items-center gap-1.5">
                          {i.tipo === "servico" && <Wrench size={12} className="text-red-500 shrink-0" />}
                          {i.nome}
                        </p>
                        <p className="text-[11px] text-slate-400">{fmtCur(i.preco)} un · {i.tipo === "servico" ? (i.descricao || "Serviço") : i.codigo}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => setVendaQtd(i.id, i.qtd - 1)} className="w-7 h-7 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 flex items-center justify-center"><Minus size={13}/></button>
                        <span className="w-9 text-center text-sm font-bold">{i.qtd}</span>
                        <button onClick={() => setVendaQtd(i.id, i.qtd + 1)} className="w-7 h-7 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 flex items-center justify-center"><Plus size={13}/></button>
                      </div>
                      <span className="w-24 text-right text-sm font-bold text-slate-800 shrink-0">{fmtCur(i.preco * i.qtd)}</span>
                      <button onClick={() => removerVenda(i.id)} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors shrink-0"><X size={14} /></button>
                    </div>
                  ))}
                </div>}
          </div>
        </div>

        {/* Coluna total / finalizar */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 sticky top-0">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Total da venda</p>
            <p className="text-4xl font-black text-slate-800 mt-1">{fmtCur(total)}</p>
            <p className="text-xs text-slate-400 mt-1">{qtdTotal} item(s) no carrinho</p>

            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mt-5 mb-2">Forma de pagamento</p>
            <div className="grid grid-cols-2 gap-2">
              {PAGAMENTOS.map(({ id, icon: I }) => (
                <button key={id} onClick={() => setVenda(p => ({ ...p, pag: id }))}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold border transition-colors ${
                    (venda.pag || "Dinheiro") === id
                      ? "bg-red-600 border-red-600 text-white"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                  <I size={14} />{id}
                </button>
              ))}
            </div>

            <button onClick={finalizarVenda} disabled={!venda.itens.length || vendaBusy}
              className="w-full mt-5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3.5 text-sm transition-colors flex items-center justify-center gap-2">
              <CheckCircle size={16} />{vendaBusy ? "Finalizando..." : "Finalizar venda"}
            </button>
            {venda.itens.length > 0 && (
              <button onClick={() => setVenda({ cb: "", q: "", itens: [], pag: "Dinheiro", msg: null })}
                className="w-full mt-2 text-slate-500 hover:text-red-600 text-xs font-medium py-2 transition-colors">
                Cancelar venda
              </button>
            )}
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-start gap-2 text-[11px] text-slate-400">
              <RefreshCw size={13} className="shrink-0 mt-0.5 text-emerald-500" />
              Ao finalizar, o estoque é baixado automaticamente para cada produto vendido.
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-800 text-sm mb-3">Vendas de hoje</h3>
            {(() => {
              const hoje = vendas.filter(v => sameDay(v.data, nowISO()));
              if (hoje.length === 0) return <p className="text-slate-400 text-xs">Nenhuma venda hoje.</p>;
              if (!isAdmin) return <p className="text-slate-600 text-sm font-semibold">{hoje.length} venda(s) registrada(s) hoje.</p>;
              return hoje.slice(0, 6).map(v => (
                <div key={v.id} className="flex justify-between items-center py-1.5 text-xs border-b border-slate-50 last:border-0">
                  <span className="font-mono text-slate-500">{v.num} <span className="text-slate-300">· {v.pag || "—"}</span></span>
                  <span className="font-semibold text-emerald-600">{fmtCur(v.total)}</span>
                </div>
              ));
            })()}
          </div>
        </div>
      </div>
    );
  };

  // ── Render: Estoque ───────────────────────────────────────────────────────
  const renderEstoque = () => {
    // Atendente só consulta o estoque (precisa disso para vender); ajustes de
    // quantidade são de Estoquista/Administrador, e custo/preço só de Administrador.
    const podeMovimentar = sess.user.cargo !== "Atendente";
    const fil = pecas.filter(p =>
      p.nome.toLowerCase().includes(search.toLowerCase()) ||
      p.codigo.toLowerCase().includes(search.toLowerCase()) ||
      (p.cb || "").toLowerCase().includes(search.toLowerCase()) ||
      p.cat.toLowerCase().includes(search.toLowerCase())
    );
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Produto, código, cód. barras..."
              className="border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-red-400 bg-white w-72 transition-colors" />
          </div>
          {podeMovimentar && (
            <BtnPrimary icon={ScanLine} onClick={() => { setBip({ cb:"", lista:[], last:null }); setModal("bipar"); }}>
              Bipar Entrada
            </BtnPrimary>
          )}
          {isAdmin && (
            <BtnOutline icon={Plus} onClick={() => { setMf({ codigo:"",cb:"",nome:"",cat:"",custo:"",preco:"",qtd:"",min:"",forn:"" }); setModal("nova_peca"); }}>
              Novo Produto
            </BtnOutline>
          )}
          {podeMovimentar && (
            <BtnOutline icon={RefreshCw} onClick={() => { setMf({ pid:"",tipo:"entrada",qtd:"",desc:"" }); setModal("mov_est"); }}>
              Ajustar Estoque
            </BtnOutline>
          )}
          {pecasErr && <p className="text-xs text-red-600 font-medium flex items-center gap-1.5"><AlertCircle size={13} />{pecasErr}</p>}
        </div>

        {isAdmin && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Valor total em estoque</p>
              <p className="text-2xl font-bold text-emerald-600 mt-0.5">{fmtCur(pecas.reduce((a,p)=>a+p.preco*p.qtd,0))}</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Produtos cadastrados</p>
              <p className="text-2xl font-bold text-slate-800 mt-0.5">{pecas.length}</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Unidades em estoque</p>
              <p className="text-2xl font-bold text-slate-800 mt-0.5">{pecas.reduce((a,p)=>a+p.qtd,0)}</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Produtos em alerta</p>
              <p className="text-2xl font-bold text-red-600 mt-0.5">{pecas.filter(p=>p.qtd<=p.min).length}</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-x-auto">
          {pecasLoading
          ? <p className="text-center text-slate-400 text-sm py-12 flex items-center justify-center gap-2"><RefreshCw size={14} className="animate-spin" />Carregando produtos...</p>
          : <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {[
                  "Código","Cód. Barras","Produto","Categoria","Estoque","Mín.","Status",
                  ...(isAdmin ? ["Custo","Margem"] : []),
                  "Preço","Fornecedor",""
                ].map(h => <Th key={h}>{h}</Th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {fil.map(p => (
                <tr key={p.id} className={`hover:bg-red-50/30 transition-colors ${p.qtd <= p.min ? "bg-red-50/40" : ""}`}>
                  <Td className="font-mono text-xs font-bold text-red-700">{p.codigo}</Td>
                  <Td>
                    <span className="flex items-center gap-1.5 font-mono text-xs text-slate-500">
                      <Barcode size={13} className="text-slate-400 shrink-0" />{p.cb || "—"}
                    </span>
                  </Td>
                  <Td className="font-semibold text-slate-800">{p.nome}</Td>
                  <Td><Badge color="slate" label={p.cat} /></Td>
                  <Td><span className={`font-bold ${p.qtd <= p.min ? "text-red-600" : "text-slate-800"}`}>{p.qtd}</span></Td>
                  <Td className="text-slate-400">{p.min}</Td>
                  <Td>{p.qtd <= p.min ? <Badge color="red" label="⚠ Baixo" /> : <Badge color="green" label="✓ OK" />}</Td>
                  {isAdmin && <Td className="text-slate-500">{fmtCur(p.custo)}</Td>}
                  {isAdmin && (() => {
                    const margem = p.preco - p.custo;
                    const pct = p.preco > 0 ? (margem / p.preco) * 100 : 0;
                    return (
                      <Td className={`font-semibold ${margem > 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {fmtCur(margem)}
                        <span className="block text-[11px] font-normal text-slate-400">{pct.toFixed(1)}%</span>
                      </Td>
                    );
                  })()}
                  <Td className="font-semibold text-slate-700">{fmtCur(p.preco)}{isAdmin && <span className="block text-[11px] font-normal text-slate-400">= {fmtCur(p.preco * p.qtd)}</span>}</Td>
                  <Td className="text-xs text-slate-400">{p.forn}</Td>
                  <Td>
                    {isAdmin && (
                      <button onClick={() => { setMf({ ...p }); setModal("edit_peca"); }}
                        className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition-colors">
                        <Edit2 size={13} />
                      </button>
                    )}
                  </Td>
                </tr>
              ))}
              {fil.length === 0 && (
                <tr><td colSpan={isAdmin ? 12 : 10} className="text-center text-slate-400 py-12 text-sm">Nenhum produto encontrado.</td></tr>
              )}
            </tbody>
          </table>}
        </div>
      </div>
    );
  };

  // ── Render: Usuários (Admin) ──────────────────────────────────────────────
  const desbloquearUser = async (u) => {
    const r = await fetch(`/api/users/${u.id}/unlock`, { method: "POST" });
    const data = await r.json();
    if (!r.ok) { alert(data.error || "Não foi possível desbloquear."); return; }
    fetchUsers();
  };

  const toggleStatusUser = async (u) => {
    const ns = u.status === "ativo" ? "inativo" : "ativo";
    const r = await fetch(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: ns }),
    });
    const data = await r.json();
    if (!r.ok) { alert(data.error || "Não foi possível alterar o status."); return; }
    fetchUsers();
  };

  const excluirUser = async (u) => {
    if (!confirm(`Excluir o usuário "${u.login}"? Esta ação não pode ser desfeita.`)) return;
    const r = await fetch(`/api/users/${u.id}`, { method: "DELETE" });
    const data = await r.json();
    if (!r.ok) { alert(data.error || "Não foi possível excluir."); return; }
    fetchUsers();
  };

  const renderUsuarios = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        {usersErr
          ? <p className="text-xs text-red-600 font-medium flex items-center gap-1.5"><AlertCircle size={13} />{usersErr}</p>
          : <span />}
        <BtnPrimary icon={UserPlus} onClick={() => { setMf({ login:"",email:"",senha:"",nome:"",cargo:"Atendente" }); setModal("novo_user"); }}>
          Novo Usuário
        </BtnPrimary>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-x-auto">
        {usersLoading
          ? <p className="text-center text-slate-400 text-sm py-12 flex items-center justify-center gap-2"><RefreshCw size={14} className="animate-spin" />Carregando usuários...</p>
          : <table className="w-full min-w-[900px]">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>{["Login","E-mail","Nome","Cargo","Cadastro","Último Acesso","Tentativas","Status","Ações"].map(h => <Th key={h}>{h}</Th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-red-50/20 transition-colors">
                <Td className="font-mono text-xs font-bold text-red-700">{u.login}</Td>
                <Td className="text-xs text-slate-500">{u.email || "—"}</Td>
                <Td className="font-semibold text-slate-800">{u.nome}</Td>
                <Td><Badge color={u.cargo === "Administrador" ? "red" : "slate"} label={u.cargo} /></Td>
                <Td className="text-xs text-slate-400">{fmtDate(u.dataCad)}</Td>
                <Td className="text-xs text-slate-400">{fmtDT(u.ultimoAcesso)}</Td>
                <Td>
                  {u.fail >= MAX_FAIL
                    ? <span className="flex items-center gap-1.5 text-xs text-red-600 font-bold"><Lock size={11} />Bloqueado</span>
                    : <span className="text-xs text-slate-400">{u.fail}/{MAX_FAIL}</span>}
                </Td>
                <Td><Badge color={u.status === "ativo" ? "green" : "red"} label={u.status === "ativo" ? "Ativo" : "Inativo"} /></Td>
                <Td>
                  <div className="flex gap-1">
                    {u.fail >= MAX_FAIL && (
                      <button title="Desbloquear conta" onClick={() => desbloquearUser(u)}
                        className="p-1.5 hover:bg-red-50 rounded text-red-500 hover:text-red-700 transition-colors">
                        <Key size={13} />
                      </button>
                    )}
                    {u.id !== sess.user.id && (
                      <button title={u.status === "ativo" ? "Desativar" : "Ativar"} onClick={() => toggleStatusUser(u)}
                        className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition-colors">
                        {u.status === "ativo" ? <X size={13} /> : <CheckCircle size={13} />}
                      </button>
                    )}
                    {u.cargo !== "Administrador" && u.id !== sess.user.id && (
                      <button title="Excluir usuário" onClick={() => excluirUser(u)}
                        className="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-500 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>}
      </div>
    </div>
  );

  // ── Render: Auditoria (Admin) ─────────────────────────────────────────────
  const renderAuditoria = () => {
    const fil = log.filter(l =>
      l.usr.toLowerCase().includes(search.toLowerCase()) ||
      l.acao.toLowerCase().includes(search.toLowerCase()) ||
      (l.det || "").toLowerCase().includes(search.toLowerCase())
    );
    const aColor = {
      LOGIN:"text-emerald-600", LOGOUT:"text-slate-400", LOGIN_FALHA:"text-red-600",
      VENDA:"text-emerald-600", USER_CRIAR:"text-blue-600", USER_EXCLUIR:"text-red-600",
      USER_STATUS:"text-amber-600", USER_DESBLOQUEAR:"text-blue-600",
      PECA_CRIAR:"text-blue-600", PECA_EDITAR:"text-amber-600",
      ESTOQUE_MOV:"text-blue-600", ESTOQUE_BIP:"text-blue-600",
    };
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filtrar log..."
              className="border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm w-64 focus:outline-none focus:border-red-400 bg-white transition-colors" />
          </div>
          {logErr && <p className="text-xs text-red-600 font-medium flex items-center gap-1.5"><AlertCircle size={13} />{logErr}</p>}
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-x-auto">
          {logLoading
          ? <p className="text-center text-slate-400 text-sm py-12 flex items-center justify-center gap-2"><RefreshCw size={14} className="animate-spin" />Carregando auditoria...</p>
          : <table className="w-full min-w-[700px]">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>{["Data / Hora","Usuário","Ação","Detalhe","IP"].map(h => <Th key={h}>{h}</Th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {fil.map(l => (
                <tr key={l.id} className="hover:bg-red-50/20 transition-colors">
                  <Td className="text-slate-400 text-xs font-mono whitespace-nowrap">{fmtDT(l.ts)}</Td>
                  <Td className="text-xs font-bold text-red-700">{l.usr}</Td>
                  <Td><span className={`text-xs font-mono font-bold ${aColor[l.acao] || "text-blue-600"}`}>{l.acao}</span></Td>
                  <Td className="text-slate-600 text-xs">{l.det}</Td>
                  <Td className="text-slate-400 text-xs font-mono">{l.ip}</Td>
                </tr>
              ))}
              {fil.length === 0 && (
                <tr><td colSpan={5} className="text-center text-slate-400 py-10 text-sm">Nenhum registro encontrado.</td></tr>
              )}
            </tbody>
          </table>}
        </div>
      </div>
    );
  };

  // ── Render: Conteúdo do módulo ────────────────────────────────────────────
  const renderContent = () => {
    if (!visNav.find(n => n.id === mod)) return <div className="text-slate-400 text-sm p-8 text-center">Módulo não disponível para o seu perfil.</div>;
    switch (mod) {
      case "dashboard": return renderDashboard();
      case "vendas":    return renderVendas();
      case "estoque":   return renderEstoque();
      case "usuarios":  return renderUsuarios();
      case "auditoria": return renderAuditoria();
      default:          return null;
    }
  };

  // ── Leitura de entrada no estoque ─────────────────────────────────────────
  const lerEntrada = () => {
    const code = String(bip.cb || "").trim();
    if (!code) return;
    const peca = acharPeca(code);
    if (!peca) {
      setBip(p => ({ ...p, cb: "", last: { ok: false, code, text: `Código "${code}" não cadastrado` } }));
      return;
    }
    setBip(p => {
      const lista = [...p.lista];
      const i = lista.findIndex(x => x.id === peca.id);
      if (i >= 0) lista[i] = { ...lista[i], qtd: lista[i].qtd + 1 };
      else lista.push({ id: peca.id, codigo: peca.codigo, nome: peca.nome, cb: peca.cb, qtd: 1 });
      return { ...p, cb: "", lista, last: { ok: true, text: `${peca.nome} +1` } };
    });
  };
  const confirmarEntrada = async () => {
    if (!bip.lista.length) { closeM(); return; }
    const r = await fetch("/api/pecas/entrada-bip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itens: bip.lista.map(l => ({ id: l.id, qtd: l.qtd })) }),
    });
    const data = await r.json();
    if (!r.ok) { alert(data.error || "Não foi possível dar entrada no estoque."); return; }
    fetchPecas();
    closeM();
  };

  // ── Render: Modais ────────────────────────────────────────────────────────
  const renderModal = () => {
    // ─ Bipar Entrada de Estoque ─
    if (modal === "bipar") {
      const totalItens = bip.lista.reduce((a, b) => a + b.qtd, 0);
      return (
        <ModalWrap title="Bipar Entrada de Estoque" onClose={closeM} wide>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                Passe o leitor ou digite o código
              </label>
              <div className="relative">
                <ScanLine size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-red-500" />
                <input
                  ref={bipRef}
                  value={bip.cb}
                  onChange={e => setBip(p => ({ ...p, cb: e.target.value }))}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); lerEntrada(); } }}
                  placeholder="Aguardando leitura..."
                  className="w-full border-2 border-red-300 rounded-xl pl-10 pr-3 py-3 text-base font-mono focus:outline-none focus:border-red-500 bg-red-50/40 transition-colors" />
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">Cada bipe soma 1 unidade. Confirme no final para dar entrada no estoque.</p>
            </div>

            {bip.last && (
              bip.last.ok
                ? <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl px-3.5 py-2.5">
                    <CheckCircle size={15} className="shrink-0" /><span className="font-medium">{bip.last.text}</span>
                  </div>
                : <div className="flex items-center justify-between gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-3.5 py-2.5">
                    <span className="flex items-center gap-2"><AlertCircle size={15} className="shrink-0" /><span className="font-medium">{bip.last.text}</span></span>
                    <button onClick={() => { setMf({ codigo:"", cb:bip.last.code, nome:"", cat:"", custo:"", preco:"", qtd:"", min:"", forn:"" }); setModal("nova_peca"); }}
                      className="text-xs font-semibold underline shrink-0 hover:text-red-800">Cadastrar produto</button>
                  </div>
            )}

            <div className="border border-slate-100 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between bg-slate-50 px-4 py-2.5 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Produtos lidos</span>
                <span className="text-xs font-semibold text-slate-600">{totalItens} item(s)</span>
              </div>
              {bip.lista.length === 0
                ? <p className="text-center text-slate-400 text-sm py-8">Nenhum produto lido ainda. Bipe o primeiro código.</p>
                : <div className="divide-y divide-slate-50 max-h-56 overflow-y-auto">
                    {bip.lista.map(l => (
                      <div key={l.id} className="flex items-center gap-3 px-4 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-800 truncate">{l.nome}</p>
                          <p className="text-[11px] font-mono text-slate-400">{l.codigo} · {l.cb || "sem cód. barras"}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button onClick={() => setBip(p => ({ ...p, lista: p.lista.map(x => x.id===l.id ? {...x, qtd:Math.max(1,x.qtd-1)} : x) }))} className="w-7 h-7 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 flex items-center justify-center"><Minus size={13}/></button>
                          <span className="w-9 text-center text-sm font-bold">{l.qtd}</span>
                          <button onClick={() => setBip(p => ({ ...p, lista: p.lista.map(x => x.id===l.id ? {...x, qtd:x.qtd+1} : x) }))} className="w-7 h-7 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 flex items-center justify-center"><Plus size={13}/></button>
                          <button onClick={() => setBip(p => ({ ...p, lista: p.lista.filter(x => x.id!==l.id) }))} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"><X size={14} /></button>
                        </div>
                      </div>
                    ))}
                  </div>}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <BtnOutline onClick={closeM}>Cancelar</BtnOutline>
              <BtnPrimary icon={CheckCircle} onClick={confirmarEntrada}>Confirmar entrada ({totalItens})</BtnPrimary>
            </div>
          </div>
        </ModalWrap>
      );
    }

    // ─ Novo Produto ─
    if (modal === "nova_peca") return (
      <ModalWrap title="Cadastrar Novo Produto" onClose={closeM}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Fld label="Código"><Inp placeholder="P008" value={mf.codigo || ""} onChange={e => setMf(p => ({ ...p, codigo: e.target.value.toUpperCase() }))} /></Fld>
            <Fld label="Categoria"><Inp placeholder="Ex: Freios" value={mf.cat || ""} onChange={e => setMf(p => ({ ...p, cat: e.target.value }))} /></Fld>
          </div>
          <Fld label="Código de barras">
            <div className="relative">
              <Barcode size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Inp className="pl-9 font-mono" placeholder="Bipe ou digite a numeração" value={mf.cb || ""}
                onChange={e => setMf(p => ({ ...p, cb: e.target.value }))} />
            </div>
          </Fld>
          <Fld label="Nome do produto"><Inp placeholder="Nome completo do produto" value={mf.nome || ""} onChange={e => setMf(p => ({ ...p, nome: e.target.value }))} /></Fld>
          <div className="grid grid-cols-2 gap-4">
            <Fld label="Valor de Compra (R$)"><Inp type="number" placeholder="0,00" value={mf.custo || ""} onChange={e => setMf(p => ({ ...p, custo: e.target.value }))} /></Fld>
            <Fld label="Valor de Venda (R$)"><Inp type="number" placeholder="0,00" value={mf.preco || ""} onChange={e => setMf(p => ({ ...p, preco: e.target.value }))} /></Fld>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Fld label="Qtd inicial"><Inp type="number" placeholder="0" value={mf.qtd || ""} onChange={e => setMf(p => ({ ...p, qtd: e.target.value }))} /></Fld>
            <Fld label="Estoque mínimo"><Inp type="number" placeholder="5" value={mf.min || ""} onChange={e => setMf(p => ({ ...p, min: e.target.value }))} /></Fld>
          </div>
          <Fld label="Fornecedor"><Inp placeholder="Nome do fornecedor" value={mf.forn || ""} onChange={e => setMf(p => ({ ...p, forn: e.target.value }))} /></Fld>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <BtnOutline onClick={closeM}>Cancelar</BtnOutline>
            <BtnPrimary onClick={async () => {
              if (!mf.codigo || !mf.nome) { alert("Preencha código e nome."); return; }
              if (!mf.custo || !mf.preco) { alert("Informe o valor de compra e o valor de venda."); return; }
              const r = await fetch("/api/pecas", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ codigo: mf.codigo, cb: mf.cb || undefined, nome: mf.nome, cat: mf.cat || undefined, custo: mf.custo, preco: mf.preco, qtd: mf.qtd, min: mf.min, forn: mf.forn || undefined }),
              });
              const data = await r.json();
              if (!r.ok) { alert(data.error || "Não foi possível cadastrar o produto."); return; }
              fetchPecas();
              closeM();
            }}>Cadastrar</BtnPrimary>
          </div>
        </div>
      </ModalWrap>
    );

    // ─ Editar Produto ─
    if (modal === "edit_peca") return (
      <ModalWrap title="Editar Produto" onClose={closeM}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Fld label="Código"><Inp value={mf.codigo || ""} onChange={e => setMf(p => ({ ...p, codigo: e.target.value.toUpperCase() }))} /></Fld>
            <Fld label="Categoria"><Inp value={mf.cat || ""} onChange={e => setMf(p => ({ ...p, cat: e.target.value }))} /></Fld>
          </div>
          <Fld label="Código de barras">
            <div className="relative">
              <Barcode size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Inp className="pl-9 font-mono" placeholder="Bipe ou digite a numeração" value={mf.cb || ""}
                onChange={e => setMf(p => ({ ...p, cb: e.target.value }))} />
            </div>
          </Fld>
          <Fld label="Nome do produto"><Inp value={mf.nome || ""} onChange={e => setMf(p => ({ ...p, nome: e.target.value }))} /></Fld>
          <div className="grid grid-cols-2 gap-4">
            <Fld label="Valor de Compra (R$)"><Inp type="number" value={mf.custo || ""} onChange={e => setMf(p => ({ ...p, custo: e.target.value }))} /></Fld>
            <Fld label="Valor de Venda (R$)"><Inp type="number" value={mf.preco || ""} onChange={e => setMf(p => ({ ...p, preco: e.target.value }))} /></Fld>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Fld label="Estoque atual"><Inp type="number" value={mf.qtd || ""} onChange={e => setMf(p => ({ ...p, qtd: e.target.value }))} /></Fld>
            <Fld label="Mínimo"><Inp type="number" value={mf.min || ""} onChange={e => setMf(p => ({ ...p, min: e.target.value }))} /></Fld>
          </div>
          <Fld label="Fornecedor"><Inp value={mf.forn || ""} onChange={e => setMf(p => ({ ...p, forn: e.target.value }))} /></Fld>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <BtnOutline onClick={closeM}>Cancelar</BtnOutline>
            <BtnPrimary onClick={async () => {
              if (!mf.custo || !mf.preco) { alert("Informe o valor de compra e o valor de venda."); return; }
              const r = await fetch(`/api/pecas/${mf.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ codigo: mf.codigo, cb: mf.cb || undefined, nome: mf.nome, cat: mf.cat || undefined, custo: mf.custo, preco: mf.preco, qtd: mf.qtd, min: mf.min, forn: mf.forn || undefined }),
              });
              const data = await r.json();
              if (!r.ok) { alert(data.error || "Não foi possível salvar as alterações."); return; }
              fetchPecas();
              closeM();
            }}>Salvar alterações</BtnPrimary>
          </div>
        </div>
      </ModalWrap>
    );

    // ─ Ajustar Estoque (manual) ─
    if (modal === "mov_est") return (
      <ModalWrap title="Ajustar Estoque" onClose={closeM}>
        <div className="space-y-4">
          <Fld label="Produto">
            <Sel value={mf.pid || ""} onChange={e => setMf(p => ({ ...p, pid: e.target.value }))}>
              <option value="">Selecionar produto...</option>
              {pecas.map(p => <option key={p.id} value={p.id}>{p.codigo} – {p.nome} (Estoque: {p.qtd})</option>)}
            </Sel>
          </Fld>
          <div className="grid grid-cols-2 gap-4">
            <Fld label="Tipo">
              <Sel value={mf.tipo || "entrada"} onChange={e => setMf(p => ({ ...p, tipo: e.target.value }))}>
                <option value="entrada">↑ Entrada (compra/devolução)</option>
                <option value="saida">↓ Saída (perda/ajuste)</option>
              </Sel>
            </Fld>
            <Fld label="Quantidade"><Inp type="number" placeholder="0" min="1" value={mf.qtd || ""} onChange={e => setMf(p => ({ ...p, qtd: e.target.value }))} /></Fld>
          </div>
          <Fld label="Motivo / Referência"><Inp placeholder="Ex: NF-001, Ajuste de inventário..." value={mf.desc || ""} onChange={e => setMf(p => ({ ...p, desc: e.target.value }))} /></Fld>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <BtnOutline onClick={closeM}>Cancelar</BtnOutline>
            <BtnPrimary onClick={async () => {
              if (!mf.pid || !mf.qtd || Number(mf.qtd) <= 0) { alert("Selecione o produto e informe a quantidade."); return; }
              const q = Number(mf.qtd);
              const r = await fetch(`/api/pecas/${mf.pid}/movimento`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tipo: mf.tipo, qtd: q, desc: mf.desc || undefined }),
              });
              const data = await r.json();
              if (!r.ok) { alert(data.error || "Não foi possível ajustar o estoque."); return; }
              fetchPecas();
              closeM();
            }}>Confirmar</BtnPrimary>
          </div>
        </div>
      </ModalWrap>
    );

    // ─ Novo Usuário ─
    if (modal === "novo_user") return (
      <ModalWrap title="Cadastrar Novo Usuário" onClose={closeM}>
        <div className="space-y-4">
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2">
            <Shield size={13} className="shrink-0 mt-0.5" />
            Apenas o Administrador pode cadastrar usuários. A senha é criptografada antes de ser armazenada.
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Fld label="Login">
              <Inp placeholder="usuario.login" value={mf.login || ""}
                onChange={e => setMf(p => ({ ...p, login: e.target.value.toLowerCase().replace(/\s/g, ".") }))} />
            </Fld>
            <Fld label="Cargo">
              <Sel value={mf.cargo || "Atendente"} onChange={e => setMf(p => ({ ...p, cargo: e.target.value }))}>
                {ROLES.map(r => <option key={r}>{r}</option>)}
              </Sel>
            </Fld>
          </div>
          <Fld label="Nome completo"><Inp placeholder="Nome do usuário" value={mf.nome || ""} onChange={e => setMf(p => ({ ...p, nome: e.target.value }))} /></Fld>
          {mf.cargo === "Administrador" && (
            <Fld label="E-mail (usado para entrar no sistema)">
              <Inp type="email" placeholder="admin@suaoficina.com" value={mf.email || ""}
                onChange={e => setMf(p => ({ ...p, email: e.target.value }))} />
            </Fld>
          )}
          <Fld label="Senha inicial">
            <div className="relative">
              <Inp type={showP ? "text" : "password"} placeholder="Mínimo 6 caracteres" className="pr-9"
                value={mf.senha || ""} onChange={e => setMf(p => ({ ...p, senha: e.target.value }))} />
              <button onClick={() => setShowP(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                {showP ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </Fld>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <BtnOutline onClick={closeM}>Cancelar</BtnOutline>
            <BtnPrimary onClick={async () => {
              if (!mf.login || !mf.nome || !mf.senha) { alert("Preencha todos os campos."); return; }
              if (mf.senha.length < 6) { alert("Senha deve ter no mínimo 6 caracteres."); return; }
              if (users.find(u => u.login === mf.login)) { alert("Login já cadastrado. Escolha outro."); return; }
              if (mf.cargo === "Administrador") {
                if (!mf.email) { alert("Informe o e-mail do administrador."); return; }
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mf.email)) { alert("E-mail inválido."); return; }
              }
              const r = await fetch("/api/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ login: mf.login, email: mf.email || undefined, senha: mf.senha, nome: mf.nome, cargo: mf.cargo || "Atendente" }),
              });
              const data = await r.json();
              if (!r.ok) { alert(data.error || "Não foi possível cadastrar o usuário."); return; }
              fetchUsers();
              closeM(); setShowP(false);
            }}>Cadastrar usuário</BtnPrimary>
          </div>
        </div>
      </ModalWrap>
    );

    return null;
  };

  // ── Layout principal ──────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className={`${sbar ? "w-60" : "w-16"} bg-white border-r border-slate-200 flex flex-col shrink-0 transition-all duration-200 overflow-hidden`}>
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-3 py-4 border-b border-slate-100 shrink-0">
          <div className="bg-red-600 p-1.5 rounded-lg shrink-0 shadow-sm">
            <Cross size={16} className="text-white" strokeWidth={2.5} />
          </div>
          {sbar && (
            <div className="overflow-hidden">
              <p className="text-slate-800 text-xs font-bold leading-tight whitespace-nowrap">Santo Expedito</p>
              <p className="text-red-500 text-[10px] whitespace-nowrap">Oficina & Borracharia</p>
            </div>
          )}
        </div>

        {/* Navegação */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {visNav.map(n => (
            <button key={n.id} onClick={() => goMod(n.id)} title={!sbar ? n.label : undefined}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl text-sm font-medium transition-all
                ${mod === n.id
                  ? "bg-red-600 text-white shadow-sm shadow-red-200"
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                }`}>
              <n.icon size={16} className="shrink-0" />
              {sbar && <span className="whitespace-nowrap">{n.label}</span>}
            </button>
          ))}
        </nav>

        {/* User info + logout */}
        <div className="border-t border-slate-100 p-3 shrink-0">
          {sbar && (
            <div className="mb-2 px-1">
              <p className="text-slate-800 text-xs font-semibold truncate">{sess.user.nome}</p>
              <p className="text-slate-400 text-[10px] truncate">{sess.user.cargo}</p>
            </div>
          )}
          <button onClick={doLogout} title={!sbar ? "Sair" : undefined}
            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 text-xs transition-colors font-medium ${!sbar ? "justify-center" : ""}`}>
            <LogOut size={14} />{sbar && "Sair do sistema"}
          </button>
        </div>
      </aside>

      {/* Área principal */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Topbar */}
        <header className="bg-white border-b border-slate-100 px-5 py-3 flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <button onClick={() => setSbar(p => !p)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
              <Menu size={18} />
            </button>
            <div className="flex items-center gap-1.5 text-sm text-slate-400">
              <span className="text-slate-300">Sistema</span>
              <ChevronRight size={12} />
              <span className="font-semibold text-slate-800">{curNav?.label || "Dashboard"}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {stats.al > 0 && (
              <button onClick={() => goMod("estoque")}
                className="flex items-center gap-1.5 text-xs bg-red-50 text-red-700 border border-red-200 px-3 py-1.5 rounded-full font-semibold hover:bg-red-100 transition-colors">
                <AlertTriangle size={11} />{stats.al} alerta{stats.al > 1 ? "s" : ""}
              </button>
            )}
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-slate-700 leading-none">{sess.user.nome}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{sess.user.cargo}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white text-xs font-black shadow-sm">
              {sess.user.nome.charAt(0)}
            </div>
          </div>
        </header>

        {/* Conteúdo */}
        <main className="flex-1 overflow-y-auto p-5">
          {renderContent()}
        </main>
      </div>

      {/* Modais */}
      {modal && renderModal()}
    </div>
  );
}