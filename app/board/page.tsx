import { BoardClient, BoardTitle } from "@/components/board/BoardClient";

export default function BoardPage() {
  return (
    <>
      <section className="px-6 md:px-10 pt-[120px] pb-[64px] text-center">
        <BoardTitle />
      </section>
      <BoardClient />
    </>
  );
}
