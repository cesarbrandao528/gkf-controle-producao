import React, { useEffect, useState } from 'react';
import {
  fetchAllUsers,
  setRole,
  deleteUserDoc,
  UserProfile,
  UserRole,
} from '../firebase';
import {
  Users,
  X,
  Shield,
  Edit3,
  Eye,
  CheckCircle2,
  RefreshCw,
  Search,
  UserCheck,
  Trash2,
} from 'lucide-react';

interface UserManagementModalProps {
  currentUser: UserProfile;
  onClose: () => void;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  currentUser,
  onClose,
}) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    const list = await fetchAllUsers();
    setUsers(list);
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    setUpdatingId(userId);
    setFeedback(null);
    const ok = await setRole(userId, newRole, currentUser.email);
    if (ok) {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole, approvedBy: currentUser.email } : u))
      );
      setFeedback('Permissão atualizada com sucesso!');
      setTimeout(() => setFeedback(null), 3000);
    } else {
      setFeedback('Erro ao atualizar permissão. Verifique sua conexão.');
    }
    setUpdatingId(null);
  };

  const handleDeleteUser = async (user: UserProfile) => {
    if (
      !confirm(
        `Tem certeza que deseja excluir o acesso de "${user.displayName || user.email}"? O usuário perderá permissão total ao sistema.`
      )
    ) {
      return;
    }
    setUpdatingId(user.id);
    setFeedback(null);
    const ok = await deleteUserDoc(user.id);
    if (ok) {
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      setFeedback(`Acesso de ${user.email} excluído com sucesso! ✓`);
      setTimeout(() => setFeedback(null), 3000);
    } else {
      setFeedback('Erro ao excluir usuário. Tente novamente.');
    }
    setUpdatingId(null);
  };

  const filtered = users.filter(
    (u) =>
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.displayName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div className="w-full max-w-3xl bg-[var(--bgB)] border border-[var(--ln)] rounded-3xl p-6 shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[var(--ln)]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[rgba(var(--cyr),0.15)] text-[var(--cy)]">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--tx)]">
                Gestão de Usuários e Autorizações
              </h2>
              <p className="text-xs text-[var(--mu)]">
                Controle quem tem acesso para visualizar ou editar os dados de produção
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--mu)] hover:text-[var(--tx)] hover:bg-white/5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Public Sharing URL Banner */}
        <div className="mt-3.5 p-3 rounded-2xl bg-blue-500/10 border border-blue-500/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <span className="font-bold text-blue-300 flex items-center gap-1.5">
              <span>🔗 Link público para compartilhar com sua equipe:</span>
            </span>
            <p className="text-[11px] text-[var(--mu)]">
              Envie este link para qualquer pessoa acessar e criar seu login corporativo (evita o erro 403 do link de dev):
            </p>
            <code className="text-[11px] text-[var(--cy)] font-mono block select-all">
              https://ais-pre-fqdhk2i6igejyrd5v5vdyo-715953476300.us-west2.run.app
            </code>
          </div>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText('https://ais-pre-fqdhk2i6igejyrd5v5vdyo-715953476300.us-west2.run.app');
              setFeedback('Link público copiado para a área de transferência! ✓');
              setTimeout(() => setFeedback(null), 3500);
            }}
            className="shrink-0 px-3 py-1.5 rounded-xl font-bold bg-[var(--cy)] hover:bg-blue-600 text-white shadow transition-all cursor-pointer text-xs"
          >
            Copiar Link
          </button>
        </div>

        {/* Toolbar & Filter */}
        <div className="flex items-center justify-between gap-3 py-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-[var(--mu)]" />
            <input
              type="text"
              placeholder="Buscar por nome ou e-mail..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-[rgba(var(--w),0.06)] border border-[var(--ln)] text-[var(--tx)] text-xs outline-none focus:border-[var(--cy)]"
            />
          </div>

          <button
            type="button"
            onClick={loadUsers}
            disabled={loading}
            className="px-3 py-2 rounded-xl text-xs font-semibold border border-[var(--ln)] text-[var(--mu)] hover:text-[var(--tx)] flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>

        {feedback && (
          <div className="mb-3 p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{feedback}</span>
          </div>
        )}

        {/* Table of Users */}
        <div className="gkf-table-wrap flex-1 overflow-y-auto">
          <table className="gkf-table">
            <thead>
              <tr>
                <th>Usuário / E-mail</th>
                <th>Data Cadastro</th>
                <th>Perfil Atual</th>
                <th className="text-right">Ação / Autorização</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-xs text-[var(--mu)]">
                    {loading ? 'Carregando usuários...' : 'Nenhum usuário encontrado.'}
                  </td>
                </tr>
              ) : (
                filtered.map((u) => {
                  const isCurrent = u.id === currentUser.id;
                  const isSuper = u.email === 'cesar@gkfengenharia.com.br';

                  return (
                    <tr key={u.id}>
                      <td>
                        <div className="font-semibold text-xs text-[var(--tx)]">
                          {u.displayName || 'Sem nome'}
                          {isCurrent && (
                            <span className="ml-2 text-[10px] text-[var(--cy)] font-normal">
                              (você)
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[var(--mu)]">{u.email}</div>
                      </td>
                      <td className="text-xs text-[var(--mu)]">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td>
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            u.role === 'gestor'
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              : u.role === 'editor'
                              ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                              : 'bg-slate-500/15 text-slate-300 border border-slate-500/30'
                          }`}
                        >
                          {u.role === 'gestor' && <Shield className="w-3 h-3" />}
                          {u.role === 'editor' && <Edit3 className="w-3 h-3" />}
                          {u.role === 'leitor' && <Eye className="w-3 h-3" />}
                          {u.role === 'gestor'
                            ? 'Gestor'
                            : u.role === 'editor'
                            ? 'Editor'
                            : 'Leitor'}
                        </span>
                      </td>
                      <td className="text-right">
                        {isSuper ? (
                          <span className="text-xs text-[var(--mu)] italic">Gestor Principal</span>
                        ) : (
                          <div className="inline-flex items-center gap-1.5">
                            {u.role !== 'editor' && (
                              <button
                                type="button"
                                disabled={updatingId === u.id}
                                onClick={() => handleRoleChange(u.id, 'editor')}
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 flex items-center gap-1"
                                title="Autorizar usuário a fazer edições"
                              >
                                <UserCheck className="w-3 h-3" />
                                Tornar Editor
                              </button>
                            )}

                            {u.role !== 'leitor' && (
                              <button
                                type="button"
                                disabled={updatingId === u.id}
                                onClick={() => handleRoleChange(u.id, 'leitor')}
                                className="px-2.5 py-1 text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 text-[var(--mu)] border border-[var(--ln)] flex items-center gap-1"
                                title="Restringir apenas para visualização"
                              >
                                <Eye className="w-3 h-3" />
                                Apenas Leitor
                              </button>
                            )}

                            {u.role !== 'gestor' && (
                              <button
                                type="button"
                                disabled={updatingId === u.id}
                                onClick={() => handleRoleChange(u.id, 'gestor')}
                                className="px-2 py-1 text-[11px] font-medium rounded-lg hover:bg-amber-500/15 text-amber-400"
                                title="Promover a Gestor"
                              >
                                + Gestor
                              </button>
                            )}

                            {/* Excluir acesso */}
                            {!isCurrent && (
                              <button
                                type="button"
                                disabled={updatingId === u.id}
                                onClick={() => handleDeleteUser(u)}
                                className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 border border-rose-500/30 transition-all cursor-pointer ml-1"
                                title="Excluir acesso do usuário"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="pt-4 mt-2 border-t border-[var(--ln)] flex items-center justify-between text-xs text-[var(--mu)]">
          <span>Total cadastrado: {users.length} usuários</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl font-bold bg-[rgba(var(--w),0.07)] hover:bg-[rgba(var(--w),0.12)] text-[var(--tx)]"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
