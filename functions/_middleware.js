export async function onRequest(context) {
  const url = new URL(context.request.url);
  const shopBase = '/guitars-and-gear-for-sale';

  if (
    url.pathname.startsWith(`${shopBase}/`) &&
    !url.pathname.startsWith(`${shopBase}/assets/`) &&
    url.pathname !== `${shopBase}/`
  ) {
    const assetUrl = new URL(context.request.url);
    assetUrl.pathname = `${shopBase}/`;
    return context.env.ASSETS.fetch(new Request(assetUrl, context.request));
  }

  return context.next();
}
