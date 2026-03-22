import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;

function getTransport() {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  });
  return transporter;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "hris@localhost";
  const t = getTransport();
  if (!t) {
    console.info(`[email:not-configured] To: ${opts.to} | ${opts.subject}\n${opts.text}`);
    return { ok: true, skipped: true };
  }
  try {
    await t.sendMail({
      from,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html ?? opts.text.replace(/\n/g, "<br/>"),
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[email]", msg);
    return { ok: false, error: msg };
  }
}
