import { signIn } from "@/auth";
import { Wordmark } from "@/components/brand/Wordmark";

type SearchParams = Promise<{ error?: string; from?: string }>;

export default async function SignInPage(props: { searchParams: SearchParams }) {
  const params = await props.searchParams;
  const errorKind = params.error;

  return (
    <main className="min-h-[80vh] flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center py-[120px]">
        <Wordmark className="mb-6" />
        <p className="caption-uppercase mb-12">SIGN IN TO CONTINUE</p>

        {errorKind === "not_allowed" && (
          <p
            className="caption-uppercase mb-12"
            style={{ color: "var(--color-warning)" }}
          >
            THIS EMAIL IS NOT ON THE ALLOW-LIST. CONTACT THE OWNER.
          </p>
        )}

        <div className="flex flex-col gap-4">
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: params.from ?? "/" });
            }}
          >
            <button type="submit" className="btn-primary w-full">
              CONTINUE WITH GOOGLE
            </button>
          </form>
          <form
            action={async () => {
              "use server";
              await signIn("github", { redirectTo: params.from ?? "/" });
            }}
          >
            <button type="submit" className="btn-primary w-full">
              CONTINUE WITH GITHUB
            </button>
          </form>
        </div>

        <p
          className="caption-uppercase mt-12"
          style={{ color: "var(--color-muted-soft)" }}
        >
          ACCESS IS RESTRICTED TO PRE-APPROVED EMAILS.
        </p>
      </div>
    </main>
  );
}
