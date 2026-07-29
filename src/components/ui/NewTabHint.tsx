/**
 * Appended inside a link that opens in a new tab.
 *
 * Losing the back button without warning is disorienting for everyone and
 * particularly so for screen-reader and screen-magnifier users, who get no
 * visual cue that the window changed at all. Visually hidden, so the layout
 * is untouched and the announcement rides along with the link's own name.
 *
 * Advisory rather than required — SC 3.2.5 is AAA — but it costs nothing.
 */
export default function NewTabHint({ isHe }: { isHe: boolean }) {
  return (
    <span className="sr-only">
      {isHe ? ' (נפתח בלשונית חדשה)' : ' (opens in a new tab)'}
    </span>
  );
}
