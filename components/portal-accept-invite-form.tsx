"use client";

type Props = {
  token: string;
  name: string;
  email: string;
  acceptAction: (formData: FormData) => void | Promise<void>;
};

export function PortalAcceptInviteForm({ token, name, email, acceptAction }: Props) {
  return (
    <form action={acceptAction} className="mt-6 grid gap-3">
      <input type="hidden" name="token" value={token} />
      <label className="grid gap-2">
        <span className="label">Name</span>
        <input name="name" className="input" defaultValue={name} required autoComplete="name" />
      </label>
      <label className="grid gap-2">
        <span className="label">Email</span>
        <input className="input" value={email} disabled readOnly autoComplete="email" />
      </label>
      <label className="grid gap-2">
        <span className="label">Password</span>
        <input
          name="password"
          type="password"
          className="input"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </label>
      <label className="grid gap-2">
        <span className="label">Confirm password</span>
        <input
          name="confirmPassword"
          type="password"
          className="input"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </label>
      <button type="submit" className="btn mt-2">
        Activate account
      </button>
    </form>
  );
}
