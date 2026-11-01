export const metadata = { title: "Privacy Policy" }

export default function PrivacyPage() {
  return (
    <main className="container mx-auto max-w-2xl px-4 py-10 space-y-4 text-sm leading-7">
      <h1 className="text-2xl font-bold">Privacy Policy</h1>
      <p>
        This is a private inventory and sales management tool used only by its owner for their own
        eBay seller account. It is not offered to other users.
      </p>
      <p>
        With the owner&apos;s consent, the tool reads the owner&apos;s own eBay order and fee
        information through the eBay APIs to record sales and calculate profit. The data is stored
        in the owner&apos;s private database, is not sold or shared with any third party, and the
        access token is stored encrypted.
      </p>
      <p>The owner can revoke access at any time from their eBay account settings.</p>
    </main>
  )
}
