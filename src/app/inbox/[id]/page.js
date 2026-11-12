import Thread from './Thread';

export default async function ConversationPage({params}) {
  const {id} = await params;
  return <Thread key={id} conversationId={id} />;
}
