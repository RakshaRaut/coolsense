import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AirVent, Cpu, Home, ThermometerSun } from 'lucide-react'
import type { AcDevice } from '@/types'
import { INSULATION_LIST, MODEL_CATALOG } from '@/utils/constants'
import { createDevice, updateDevice } from '@/api/devices.api'
import { errorMessage } from '@/api/axios'
import { useToast } from '@/contexts/ToastProvider'
import { useSettings } from '@/contexts/SettingsProvider'
import { Modal } from '@/components/common/Modal'
import { Button } from '@/components/common/Button'
import { Field, Input, InputGroup } from '@/components/common/Input'
import { Select } from '@/components/common/Select'
import { Slider } from '@/components/common/Slider'

const schema = z.object({
  name: z.string().min(2, 'Give the device a name').max(48, 'Keep the name under 48 characters'),
  key: z
    .string()
    .min(4, 'Device key must be at least 4 characters')
    .regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers and dashes only'),
  modelId: z.string().min(1, 'Select a model'),
  location: z.string().min(2, 'Where is the unit installed?'),
  roomName: z.string().min(1, 'Room name is required'),
  areaM2: z.number().min(5, 'Minimum 5 m²').max(300, 'Maximum 300 m²'),
  initialRoomTempC: z.number().min(10, 'Minimum 10 °C').max(45, 'Maximum 45 °C'),
  outsideTempC: z.number().min(-10).max(55),
  humidityPct: z.number().min(10).max(95),
  insulation: z.enum(['poor', 'average', 'good', 'excellent']),
  occupancy: z.number().min(0).max(12),
  windowExposure: z.number().min(0).max(100),
  heatGainW: z.number().min(0).max(3000),
})

type FormValues = z.infer<typeof schema>

interface DeviceFormProps {
  open: boolean
  onClose: () => void
  device?: AcDevice | null
  onSaved?: (device: AcDevice) => void
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24)
}

export function DeviceForm({ open, onClose, device, onSaved }: DeviceFormProps) {
  const { toast } = useToast()
  const { settings } = useSettings()
  const [serverError, setServerError] = useState<string | null>(null)
  const isEdit = Boolean(device)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      key: '',
      modelId: MODEL_CATALOG[0].id,
      location: 'Home · Ground floor',
      roomName: '',
      areaM2: 22,
      initialRoomTempC: settings.defaultRoomTempC,
      outsideTempC: settings.defaultOutsideTempC,
      humidityPct: settings.defaultHumidityPct,
      insulation: 'average',
      occupancy: 1,
      windowExposure: 30,
      heatGainW: 150,
    },
  })

  useEffect(() => {
    if (!open) return
    setServerError(null)
    if (device) {
      reset({
        name: device.name,
        key: device.key,
        modelId: device.modelId,
        location: device.location,
        roomName: device.environment.roomName,
        areaM2: device.environment.areaM2,
        initialRoomTempC: device.state.roomTempC,
        outsideTempC: device.environment.outsideTempC,
        humidityPct: device.environment.humidityPct,
        insulation: device.environment.insulation,
        occupancy: device.environment.occupancy,
        windowExposure: Math.round(device.environment.windowExposure * 100),
        heatGainW: device.environment.heatGainW,
      })
    } else {
      reset({
        name: '',
        key: '',
        modelId: MODEL_CATALOG[0].id,
        location: 'Home · Ground floor',
        roomName: '',
        areaM2: 22,
        initialRoomTempC: settings.defaultRoomTempC,
        outsideTempC: settings.defaultOutsideTempC,
        humidityPct: settings.defaultHumidityPct,
        insulation: 'average',
        occupancy: 1,
        windowExposure: 30,
        heatGainW: 150,
      })
    }
  }, [open, device, reset, settings])

  const modelId = watch('modelId')
  const windowExposure = watch('windowExposure')
  const occupancy = watch('occupancy')
  const model = MODEL_CATALOG.find((m) => m.id === modelId)

  const onSubmit = async (values: FormValues) => {
    setServerError(null)
    const payload = {
      name: values.name.trim(),
      key: values.key.trim(),
      modelId: values.modelId,
      location: values.location.trim(),
      roomName: values.roomName.trim(),
      areaM2: values.areaM2,
      initialRoomTempC: values.initialRoomTempC,
      outsideTempC: values.outsideTempC,
      humidityPct: values.humidityPct,
      insulation: values.insulation,
      occupancy: values.occupancy,
      windowExposure: values.windowExposure / 100,
      heatGainW: values.heatGainW,
    }
    try {
      const saved = device ? await updateDevice(device.id, payload) : await createDevice(payload)
      toast({
        title: device ? 'Device updated' : 'Device registered',
        description: `${saved.name} is ready in ${saved.environment.roomName}.`,
        variant: 'success',
      })
      onSaved?.(saved)
      onClose()
    } catch (error) {
      setServerError(errorMessage(error))
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      icon={<AirVent className="size-4" />}
      title={isEdit ? `Edit ${device?.name}` : 'Register a virtual AC'}
      description="Configure the unit and the room it cools. Everything is simulated — no hardware required."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit(onSubmit)} loading={isSubmitting}>
            {isEdit ? 'Save changes' : 'Register device'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
        {serverError ? (
          <p className="rounded-lg border border-danger/25 bg-danger-soft px-3 py-2 text-[11.5px] text-danger">
            {serverError}
          </p>
        ) : null}

        {/* Identity */}
        <section className="space-y-3.5">
          <SectionLabel icon={<Cpu className="size-3.5" />} title="Device identity" />
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Device name" error={errors.name?.message} required htmlFor="device-name">
              <Input
                id="device-name"
                placeholder="Living Room AC"
                invalid={Boolean(errors.name)}
                {...register('name')}
                onBlur={(event) => {
                  if (!watch('key') && event.target.value) {
                    setValue('key', `cs-${slugify(event.target.value)}`)
                  }
                }}
              />
            </Field>
            <Field
              label="Device key"
              hint="unique"
              error={errors.key?.message}
              required
              htmlFor="device-key"
            >
              <Input
                id="device-key"
                placeholder="cs-living-room"
                className="font-mono text-[12px]"
                invalid={Boolean(errors.key)}
                {...register('key')}
              />
            </Field>
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="AC model" error={errors.modelId?.message} required htmlFor="device-model">
              <Select
                id="device-model"
                invalid={Boolean(errors.modelId)}
                {...register('modelId')}
                options={MODEL_CATALOG.map((m) => ({
                  value: m.id,
                  label: `${m.brand} · ${m.name}`,
                }))}
              />
            </Field>
            <Field label="Location" error={errors.location?.message} required htmlFor="device-location">
              <InputGroup icon={<Home className="size-3.5" />}>
                <Input
                  id="device-location"
                  placeholder="Home · First floor"
                  className="pl-9"
                  invalid={Boolean(errors.location)}
                  {...register('location')}
                />
              </InputGroup>
            </Field>
          </div>

          {model ? (
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-line bg-card-2 px-3 py-2.5 sm:grid-cols-4">
              <Spec label="Type" value={model.type} />
              <Spec label="Compressor" value={model.inverter ? 'Inverter' : 'Fixed speed'} />
              <Spec label="Cooling" value={`${model.coolingCapacityKw} kW`} />
              <Spec label="Rated draw" value={`${model.ratedPowerW} W`} />
            </div>
          ) : null}
        </section>

        {/* Room */}
        <section className="space-y-3.5">
          <SectionLabel icon={<ThermometerSun className="size-3.5" />} title="Room environment" />
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Room name" error={errors.roomName?.message} required htmlFor="device-room">
              <Input
                id="device-room"
                placeholder="Living Room"
                invalid={Boolean(errors.roomName)}
                {...register('roomName')}
              />
            </Field>
            <Field
              label="Floor area"
              hint="m²"
              error={errors.areaM2?.message}
              required
              htmlFor="device-area"
            >
              <Input
                id="device-area"
                type="number"
                min={5}
                max={300}
                invalid={Boolean(errors.areaM2)}
                {...register('areaM2', { valueAsNumber: true })}
              />
            </Field>
          </div>

          <div className="grid gap-3.5 sm:grid-cols-3">
            <Field label="Initial room temp" hint="°C" error={errors.initialRoomTempC?.message} htmlFor="device-temp">
              <Input
                id="device-temp"
                type="number"
                step="0.5"
                invalid={Boolean(errors.initialRoomTempC)}
                {...register('initialRoomTempC', { valueAsNumber: true })}
              />
            </Field>
            <Field label="Outside temp" hint="°C" error={errors.outsideTempC?.message} htmlFor="device-outside">
              <Input
                id="device-outside"
                type="number"
                step="0.5"
                invalid={Boolean(errors.outsideTempC)}
                {...register('outsideTempC', { valueAsNumber: true })}
              />
            </Field>
            <Field label="Humidity" hint="%" error={errors.humidityPct?.message} htmlFor="device-humidity">
              <Input
                id="device-humidity"
                type="number"
                invalid={Boolean(errors.humidityPct)}
                {...register('humidityPct', { valueAsNumber: true })}
              />
            </Field>
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Insulation" error={errors.insulation?.message} htmlFor="device-insulation">
              <Select
                id="device-insulation"
                {...register('insulation')}
                options={INSULATION_LIST.map((i) => ({ value: i.value, label: `${i.label} — ${i.description}` }))}
              />
            </Field>
            <Field label="Occupants" error={errors.occupancy?.message} htmlFor="device-occupancy">
              <Input
                id="device-occupancy"
                type="number"
                min={0}
                max={12}
                invalid={Boolean(errors.occupancy)}
                {...register('occupancy', { valueAsNumber: true })}
              />
            </Field>
          </div>

          <div className="grid gap-5 rounded-lg border border-line bg-card-2/60 p-3.5 sm:grid-cols-2">
            <Slider
              label="Window exposure"
              value={Number(windowExposure) || 0}
              min={0}
              max={100}
              step={5}
              unit="%"
              hint="Higher values add solar heat gain"
              onChange={(value) => setValue('windowExposure', value, { shouldValidate: true })}
            />
            <Slider
              label="Occupants"
              value={Number(occupancy) || 0}
              min={0}
              max={12}
              unit="people"
              hint="Each person adds ~110 W of sensible heat"
              onChange={(value) => setValue('occupancy', value, { shouldValidate: true })}
            />
            <div className="sm:col-span-2">
              <Slider
                label="Additional internal heat gain"
                value={Number(watch('heatGainW')) || 0}
                min={0}
                max={1500}
                step={50}
                unit="W"
                hint="Appliances, servers, lighting and other equipment"
                onChange={(value) => setValue('heatGainW', value, { shouldValidate: true })}
              />
            </div>
          </div>
        </section>
      </form>
    </Modal>
  )
}

function SectionLabel({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid size-6 place-items-center rounded-md border border-line bg-card-2 text-accent">
        {icon}
      </span>
      <h3 className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">{title}</h3>
    </div>
  )
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9.5px] font-medium tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-0.5 text-[11.5px] font-semibold text-fg capitalize">{value}</p>
    </div>
  )
}
