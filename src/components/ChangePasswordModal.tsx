import React, { useState } from 'react';
import { changeUserPassword, UserProfile } from '../firebase';
import { KeyRound, X, AlertCircle, CheckCircle2 } from 'lucide-react';

interface ChangePasswordModalProps {
  currentUser: UserProfile;
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  currentUser,
  onClose,
}) => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('A confirmação da nova senha não confere.');
      return;
    }
    if (newPassword.length < 6) {
      setError('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      await changeUserPassword(currentUser.email, oldPassword, newPassword);
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Erro ao alterar a senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div className="w-full max-w-sm bg-[var(--bgB)] border border-[var(--ln)] rounded-3xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--ln)]">
          <div className="flex items-center gap-2 text-sm font-bold text-[var(--tx)]">
            <KeyRound className="w-4 h-4 text-[var(--cy)]" />
            <span>Alterar Minha Senha</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--mu)] hover:text-[var(--tx)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {success ? (
          <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>Senha alterada com sucesso!</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--mu)] mb-1">
                Senha atual
              </label>
              <input
                type="password"
                required
                placeholder="Sua senha atual"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[rgba(var(--w),0.06)] border border-[var(--ln)] text-[var(--tx)] text-xs focus:border-[var(--cy)] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--mu)] mb-1">
                Nova senha
              </label>
              <input
                type="password"
                required
                placeholder="Mínimo 6 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[rgba(var(--w),0.06)] border border-[var(--ln)] text-[var(--tx)] text-xs focus:border-[var(--cy)] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--mu)] mb-1">
                Confirmar nova senha
              </label>
              <input
                type="password"
                required
                placeholder="Repita a nova senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[rgba(var(--w),0.06)] border border-[var(--ln)] text-[var(--tx)] text-xs focus:border-[var(--cy)] outline-none"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-xl text-xs font-medium border border-[var(--ln)] text-[var(--mu)]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-[var(--cy)] text-white hover:brightness-110"
              >
                {loading ? 'Salvando...' : 'Atualizar Senha'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
