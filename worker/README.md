# Contact form Worker

This folder holds the Cloudflare Worker behind the Contact page form.

The Worker receives the form, checks the visitor with Cloudflare Turnstile and a hidden decoy field, and emails the message to the LydiaRx inbox. Messages are sent from `website@lydiarx.ai`. Replying to one answers the visitor directly.

The inbox address is never in this repository or on the website. It is a secret in Cloudflare.

## One-off setup in Cloudflare

All steps are in the Cloudflare dashboard for the account that holds `lydiarx.ai`.

1. **Turn on Email Routing for lydiarx.ai.** Open `lydiarx.ai`, then Email, then Email Routing, and enable it. Cloudflare adds the records it needs. This is safe because nothing receives mail at lydiarx.ai.
2. **Verify the inbox.** In Email Routing, under Destination addresses, add the LydiaRx inbox. Click the link in the email Cloudflare sends to it. The Worker can only send to a verified address.
3. **Create a Turnstile widget.** Open Turnstile and add a widget. Add the hostnames `lydiarx.com`, `www.lydiarx.com` and `admin-git-lydiarx-com.github.io`. Choose the Managed mode. Keep the site key and the secret key.
4. **Connect this repository.** Open Workers & Pages, then Create, then Import a repository. Choose `lrx-web-main-v02` and set the root directory to `worker`. Cloudflare reads `wrangler.toml` and deploys. It redeploys on every push to `main`.
5. **Add two secrets.** In the new `lrx-contact` Worker, open Settings, then Variables and Secrets. Add:
   - `TURNSTILE_SECRET`: the Turnstile secret key.
   - `TO_ADDRESS`: the verified inbox from step 2.
6. **Check the custom domain.** Under the Worker's Domains & Routes, `forms.lydiarx.ai` should be listed. If a redirect rule sends all of lydiarx.ai to lydiarx.com, limit it to `lydiarx.ai` and `www.lydiarx.ai` so it skips `forms.lydiarx.ai`.

## Switching the form on

The Contact page shows an "Email us" button until the form is switched on.

1. Put the Turnstile site key into `FORM_SITEKEY` in `tools/build_site.py`.
2. Rebuild the site and push. The Contact page then shows the form.

The site key is public by design. The secret key must stay in Cloudflare.

## Checking it works

Send a test message from the Contact page. If nothing arrives, open the Worker in Cloudflare and look at Logs (Observability).
