import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

/**
 * Public landing page. If the visitor is already signed in we punt them
 * straight to the board. Otherwise they see a marketing band with a
 * single CTA into the sign-in flow.
 *
 * Per the Bugatti design system: black canvas, display-xl headline,
 * caption-uppercase tagline, single transparent pill CTA, generous
 * 120px vertical rhythm.
 */
export default async function LandingPage() {
  const session = await auth();
  if (session?.user) redirect("/board");

  return (
    <main>
      <section
        style={{
          padding: "120px 24px",
          textAlign: "center",
          maxWidth: 880,
          margin: "0 auto",
        }}
      >
        <p className="caption-uppercase" style={{ marginBottom: 24 }}>
          A PIPELINE FOR THE JOB SEARCH
        </p>
        <h1 className="display-xl" style={{ marginBottom: 32 }}>
          SARANG&rsquo;S JOB BOARD
        </h1>
        <p
          className="body-md"
          style={{
            color: "var(--color-body)",
            maxWidth: 600,
            margin: "0 auto 48px",
          }}
        >
          Track every application from wishlist to offer. Drop a job URL or
          paste a posting; AI tailors a cover letter, rewritten resume
          bullets, likely interview questions, and a one-page company brief
          against the resume you choose.
        </p>
        <Link
          href="/signin"
          className="btn-primary"
          style={{ display: "inline-flex" }}
        >
          SIGN IN TO CONTINUE
        </Link>
      </section>

      <Feature
        kicker="01 / PIPELINE BOARD"
        title="DRAG ACROSS FIVE COLUMNS"
        body="Wishlist · Applied · Interviewing · Offer · Rejected. Cards
              persist their order; statuses update live."
      />

      <Feature
        kicker="02 / GENERATED KIT"
        title="FOUR ARTIFACTS PER POSTING"
        body="Tailored cover letter, STAR-formatted resume bullets, five
              likely interview questions, and a one-page company brief.
              Export each as PDF or DOCX."
      />

      <Feature
        kicker="03 / MULTIPLE RESUMES"
        title="ONE PER SECTOR"
        body="Upload separate resumes for distinct role families. The
              system auto-tags every new job with the best-matching
              resume; override per card whenever you want."
      />

      <footer
        style={{
          textAlign: "center",
          padding: "120px 24px 64px",
          borderTop: "1px solid var(--color-hairline)",
        }}
      >
        <p
          className="caption-uppercase"
          style={{ color: "var(--color-muted-soft)" }}
        >
          ACCESS IS RESTRICTED TO PRE-APPROVED EMAILS.
        </p>
      </footer>
    </main>
  );
}

function Feature({
  kicker,
  title,
  body,
}: {
  kicker: string;
  title: string;
  body: string;
}) {
  return (
    <section
      style={{
        padding: "120px 24px",
        textAlign: "center",
        maxWidth: 720,
        margin: "0 auto",
        borderTop: "1px solid var(--color-hairline)",
      }}
    >
      <p
        className="caption-uppercase"
        style={{ marginBottom: 24, color: "var(--color-muted)" }}
      >
        {kicker}
      </p>
      <h2 className="display-md" style={{ marginBottom: 24 }}>
        {title}
      </h2>
      <p
        className="body-md"
        style={{ color: "var(--color-body)" }}
      >
        {body}
      </p>
    </section>
  );
}
