import { GuestSearch } from './guest-search'

export default function GuestLookupPage() {
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-slate-900">Guest Lookup</h1>
      <GuestSearch />
    </div>
  )
}
