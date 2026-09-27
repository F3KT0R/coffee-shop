import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ApiError, api } from '../../lib/api';

export function AdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [password, setPassword] = useState('');
  const login = useMutation({
    mutationFn: () => api.admin.login(password),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['admin'] });
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from?.startsWith('/admin') ? from : '/admin', { replace: true });
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    login.mutate();
  }

  return (
    <div className="container-page grid min-h-[60dvh] place-items-center py-10">
      <title>Prijava | Kafe za Vas</title>
      <meta name="robots" content="noindex" />
      <form onSubmit={submit} className="card w-full max-w-sm p-8">
        <h1 className="text-2xl font-bold">Administracija</h1>
        <label htmlFor="password" className="label mt-6">
          Lozinka
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoFocus
        />
        {login.error && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {login.error instanceof ApiError ? login.error.message : 'Prijava nije uspela.'}
          </p>
        )}
        <button type="submit" className="btn-primary mt-6 w-full" disabled={login.isPending || !password}>
          {login.isPending ? 'Prijava…' : 'Prijavi se'}
        </button>
      </form>
    </div>
  );
}

export default AdminLogin;
