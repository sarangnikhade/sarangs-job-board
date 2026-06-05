import { BoardClient } from "@/components/board/BoardClient";

export default function BoardPage() {
  return (
    <>
      <section className="px-6 md:px-10 pt-[120px] pb-[64px] text-center">
        <p className="caption-uppercase mb-6">PIPELINE / 2026</p>
        <h1 className="display-xl">SARANG&rsquo;S JOB BOARD</h1>
      </section>

      <BoardClient />
    </>
  );
}
