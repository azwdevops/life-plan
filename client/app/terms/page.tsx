import Link from "next/link";

export const metadata = {
  title: "Terms of Service | Life Plan",
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-10 dark:bg-zinc-950 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Terms of Service</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Last updated: August 22, 2026</p>

          <div className="mt-6 space-y-6 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            <p>
              These Terms of Service (&ldquo;Terms&rdquo;) govern your use of Life Plan (&ldquo;the App&rdquo;). By
              using the App, you agree to these Terms.
            </p>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Use of the service</h2>
              <p className="mt-2">
                Life Plan is a personal life-management application covering finances, productivity, personal
                growth, and related tools, including optional YouTube channel statistics via Google account
                integration. The App is provided for personal, non-commercial use.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Accounts</h2>
              <p className="mt-2">
                You are responsible for maintaining the confidentiality of your login credentials and for all
                activity that occurs under your account.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Google account integration
              </h2>
              <p className="mt-2">
                Connecting a Google account is optional and used solely to display your own YouTube channel
                statistics within the App, as described in our{" "}
                <Link href="/privacy" className="text-blue-600 hover:underline dark:text-blue-400">
                  Privacy Policy
                </Link>
                . You may disconnect a Google account at any time.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">No warranty</h2>
              <p className="mt-2">
                The App is provided &ldquo;as is,&rdquo; without warranty of any kind. We do not guarantee the
                accuracy of synced statistics, estimated revenue figures (which are user-configured estimates, not
                real YouTube earnings data), or uninterrupted availability of the service.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Limitation of liability
              </h2>
              <p className="mt-2">
                To the fullest extent permitted by law, Life Plan and its operator are not liable for any
                indirect, incidental, or consequential damages arising from use of the App.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Changes to the service</h2>
              <p className="mt-2">Features may be added, changed, or removed at any time without notice.</p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Changes to these terms</h2>
              <p className="mt-2">
                We may update these Terms occasionally. Continued use of the App after changes constitutes
                acceptance of the updated Terms.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Contact</h2>
              <p className="mt-2">
                Questions about these Terms can be sent through the{" "}
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
