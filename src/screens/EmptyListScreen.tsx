/** A top-level screen with a title and a message for when it has nothing to show yet. */
export function EmptyListScreen({ title, emptyTitle, emptyBody }: { title: string; emptyTitle: string; emptyBody: string }) {
  return (
    <main className="flex flex-1 flex-col gap-3.5 px-4 pt-[18px] pb-3">
      <h1 className="display text-[38px]">{title}</h1>
      <section className="card flex flex-col gap-1 p-5">
        <h2 className="m-0 text-xl font-bold">{emptyTitle}</h2>
        <p className="m-0 text-base leading-normal text-muted">{emptyBody}</p>
      </section>
    </main>
  );
}
