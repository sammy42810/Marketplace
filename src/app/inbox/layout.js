import InboxShell from './InboxShell';

export const metadata = {title: 'Inbox'};

export default function InboxLayout({children}) {
  return <InboxShell>{children}</InboxShell>;
}
