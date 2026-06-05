import { signIn } from "@/auth";

type SearchParams = Promise<{ error?: string; from?: string }>;

export default async function SignInPage(props: { searchParams: SearchParams }) {
  const params = await props.searchParams;
  const errorKind = params.error;

  return (
    <main
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "calc(100vh - 56px)",
        padding: "120px 24px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 480, textAlign: "center" }}>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 14,
            letterSpacing: "6px",
            textTransform: "uppercase",
            color: "var(--color-on-dark)",
            margin: 0,
            marginBottom: 24,
            whiteSpace: "nowrap",
          }}
        >
          SARANG&rsquo;S JOB BOARD
        </h1>

        <p
          className="caption-uppercase"
          style={{ marginBottom: 48 }}
        >
          SIGN IN TO CONTINUE
        </p>

        {errorKind === "not_allowed" && (
          <p
            className="caption-uppercase"
            style={{
              color: "var(--color-warning)",
              marginBottom: 32,
              maxWidth: 320,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            THIS EMAIL IS NOT ON THE ALLOW-LIST.
            <br />
            CONTACT THE OWNER.
          </p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: params.from ?? "/" });
            }}
          >
            <button
              type="submit"
              className="btn-primary"
              style={{ width: "100%" }}
            >
              CONTINUE WITH GOOGLE
            </button>
          </form>
          <form
            action={async () => {
              "use server";
              await signIn("github", { redirectTo: params.from ?? "/" });
            }}
          >
            <button
              type="submit"
              className="btn-primary"
              style={{ width: "100%" }}
            >
              CONTINUE WITH GITHUB
            </button>
          </form>
        </div>

        <p
          className="caption-uppercase"
          style={{
            color: "var(--color-muted-soft)",
            marginTop: 48,
            maxWidth: 360,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          ACCESS IS RESTRICTED TO PRE-APPROVED EMAILS.
        </p>
      </div>
    </main>
  );
}
