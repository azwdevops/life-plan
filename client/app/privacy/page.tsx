import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | Life Plan",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-10 dark:bg-zinc-950 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Privacy Policy</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Last updated: August 22, 2026</p>

          <div className="mt-6 space-y-6 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            <p>
              Life Plan (&ldquo;the App&rdquo;) is a personal life-management application. This policy explains
              what information the App collects, how it&rsquo;s used, and how you can control it.
            </p>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Information we collect
              </h2>
              <ul className="mt-2 list-disc space-y-1.5 pl-5">
                <li>
                  Account information you provide directly (name, email, password) to create and secure your Life
                  Plan account.
                </li>
                <li>
                  Financial, productivity, and personal-growth data you enter yourself (accounts, transactions,
                  goals, journal entries, and similar), used only to power the features you use within the App.
                </li>
                <li>
                  If you connect a Google account for the YouTube channel management feature: your Google account
                  email, and read-only YouTube channel data (channel title, thumbnail, subscriber count, view
                  count, video count, and watch-time/analytics figures) retrieved via the YouTube Data API and
                  YouTube Analytics API.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                How we use Google user data
              </h2>
              <p className="mt-2">
                Google account data is used exclusively to display your own YouTube channel statistics inside Life
                Plan (subscriber counts, view counts, watch time, and month-to-date views), synced manually by you.
                We do not use this data for advertising, do not share it with any third party, and do not use it
                to build profiles beyond what&rsquo;s shown to you in the App.
              </p>
              <p className="mt-2">
                Life Plan&rsquo;s use and transfer of information received from Google APIs adheres to the{" "}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  Google API Services User Data Policy
                </a>
                , including the Limited Use requirements.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Data storage &amp; retention
              </h2>
              <p className="mt-2">
                All data is stored in a private database and is not sold or shared with third parties. Google
                access/refresh tokens are stored only for as long as you keep a Google account connected.
                Disconnecting a Google account from the YouTube page permanently deletes its stored tokens and
                synced channel history from the App.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Revoking access</h2>
              <p className="mt-2">
                You can revoke Life Plan&rsquo;s access to your Google account at any time from your{" "}
                <a
                  href="https://myaccount.google.com/permissions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  Google Account permissions page
                </a>
                , in addition to disconnecting it from within the App.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Data sharing</h2>
              <p className="mt-2">
                We do not sell, rent, or share your personal data or Google user data with third parties, except
                as required by law.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Changes to this policy
              </h2>
              <p className="mt-2">
                We may update this policy occasionally. Continued use of the App after changes constitutes
                acceptance of the updated policy.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Contact</h2>
              <p className="mt-2">
                Questions about this policy can be sent through the{" "}
                <Link href="/support-settings" className="text-blue-600 hover:underline dark:text-blue-400">
                  Feedback
                </Link>{" "}
                page within the App.
              </p>
            </section>
          </div>

          <div className="mt-8 border-t border-zinc-100 pt-4 text-sm dark:border-zinc-800">
            <Link href="/" className="text-blue-600 hover:underline dark:text-blue-400">
              ← Back to Life Plan
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
