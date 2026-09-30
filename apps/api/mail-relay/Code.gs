/**
 * Kafe za Vas -- Gmail relay.
 *
 * The shop's server (Render) can't use Gmail's SMTP on the free plan, so it POSTs each finished,
 * designed email here over HTTPS and this script sends it from the Gmail account that owns it.
 *
 * Setup (in the Gmail account the emails should come from):
 *   1. https://script.google.com -> New project -> paste this file over the example code.
 *   2. Paste the same secret as MAIL_RELAY_SECRET on Render between the quotes below. Save.
 *   3. Deploy -> New deployment -> type "Web app"; Execute as "Me", Who has access "Anyone".
 *   4. Authorize (Advanced -> Go to project) and copy the Web app URL (ends in /exec) into
 *      MAIL_RELAY_URL on Render.
 * After editing this code: Deploy -> Manage deployments -> edit -> Version "New version" (same URL).
 */
const SECRET = 'PASTE_MAIL_RELAY_SECRET_HERE';

function doPost(e) {
  try {
    const mail = JSON.parse(e.postData.contents);
    if (SECRET.length < 24 || mail.secret !== SECRET) return reply({ ok: false, error: 'unauthorized' });
    const options = { htmlBody: mail.html, name: mail.name || 'Kafe za Vas' };
    if (mail.replyTo) options.replyTo = mail.replyTo;
    MailApp.sendEmail(mail.to, mail.subject, mail.text || '', options);
    return reply({ ok: true, remainingToday: MailApp.getRemainingDailyQuota() });
  } catch (error) {
    return reply({ ok: false, error: String(error) });
  }
}

/** Opening the URL in a browser shows that the relay is live (it never sends anything on GET). */
function doGet() {
  return reply({ ok: true, relay: 'Kafe za Vas', remainingToday: MailApp.getRemainingDailyQuota() });
}

function reply(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}
