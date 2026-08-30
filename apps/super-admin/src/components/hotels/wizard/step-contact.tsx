import { WizardField } from './field'

export function StepContact() {
  return (
    <div className="space-y-4">
      <WizardField name="addressLine" label="Address" placeholder="12 Janpath Road" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <WizardField name="city" label="City" placeholder="Bhubaneswar" />
        <WizardField name="state" label="State" placeholder="Odisha" />
        <WizardField name="pincode" label="Pincode" placeholder="751001" />
      </div>
      <WizardField name="country" label="Country" placeholder="India" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <WizardField name="contactPerson" label="Contact person" placeholder="Alok Mishra" />
        <WizardField name="phone" label="Phone" type="tel" placeholder="+91-9861200001" />
        <WizardField name="email" label="Hotel email" type="email" placeholder="frontdesk@hotel.example" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <WizardField
          name="receptionContact"
          label="Reception Contact Number"
          type="tel"
          required
          placeholder="+91-9861200001"
        />
        <WizardField
          name="roomServiceContact"
          label="Room Service Contact Number"
          type="tel"
          required
          placeholder="+91-9861200002"
        />
      </div>
    </div>
  )
}
