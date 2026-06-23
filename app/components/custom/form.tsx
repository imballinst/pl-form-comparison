import { useId, type ComponentProps } from 'react'
import { Controller, useWatch, type Control, type FieldValues, type Path, type PathValue } from 'react-hook-form'
import { Checkbox } from '../ui/checkbox'
import { Field, FieldLabel } from '../ui/field'

type CheckboxWithFieldProps<T extends FieldValues, P extends Path<T>> = ComponentProps<typeof Checkbox> & {
  name: P
  control: Control<T>
  formatValue?: (value: string) => string
  getNextValue: (checked: boolean | 'indeterminate', v: PathValue<T, P>) => PathValue<T, P>
}

export function CheckboxWithField<T extends FieldValues, P extends Path<T>>({
  control,
  name,
  value,
  formatValue,
  getNextValue,
  ...restProps
}: CheckboxWithFieldProps<T, P>) {
  const currentValue = useWatch({ control, name })
  const id = useId()

  return (
    <Field orientation="horizontal">
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <>
            <Checkbox
              {...field}
              {...restProps}
              onCheckedChange={(checked) => {
                const nextValue = getNextValue(checked, currentValue)
                field.onChange({ target: { value: nextValue } })
              }}
              id={id}
            />
            <FieldLabel htmlFor={id} className="font-normal">
              {formatValue ? formatValue(value as string) : value}
            </FieldLabel>
          </>
        )}
      />
    </Field>
  )
}
