import { reactive, ref } from 'vue'

interface FormOptions<T> {
  initialValues: T
  onSubmit: (values: T) => void | Promise<void>
  validate?: (values: T) => Record<string, string>
}

export function useForm<T extends Record<string, any>>(options: FormOptions<T>) {
  const { initialValues, onSubmit, validate } = options
  
  const values = reactive({ ...initialValues }) as T
  const errors = reactive<Record<string, string>>({})
  const touched = reactive<Record<string, boolean>>({})
  const isSubmitting = ref(false)
  const isValid = ref(true)
  
  const validateForm = () => {
    if (validate) {
      const validationErrors = validate(values)
      Object.assign(errors, validationErrors)
      isValid.value = Object.keys(validationErrors).length === 0
      return isValid.value
    }
    return true
  }
  
  const handleSubmit = async (e?: Event) => {
    if (e) e.preventDefault()
    
    // Mark all fields as touched
    Object.keys(values).forEach(key => {
      touched[key] = true
    })
    
    // Validate form
    const isFormValid = validateForm()
    if (!isFormValid) return
    
    isSubmitting.value = true
    try {
      await onSubmit(values)
    } finally {
      isSubmitting.value = false
    }
  }
  
  const handleChange = (field: keyof T, value: any) => {
    values[field] = value
    
    // Clear error when field changes
    if (errors[field as string]) {
      delete errors[field as string]
    }
    
    // Validate if field has been touched
    if (touched[field as string] && validate) {
      const validationErrors = validate(values)
      if (field in validationErrors) {
        errors[field as string] = validationErrors[field as string]
      }
    }
  }
  
  const handleBlur = (field: keyof T) => {
    touched[field as string] = true
    
    // Validate on blur
    if (validate) {
      const validationErrors = validate(values)
      if (field in validationErrors) {
        errors[field as string] = validationErrors[field as string]
      }
    }
  }
  
  const resetForm = () => {
    Object.keys(values).forEach(key => {
      values[key] = initialValues[key]
    })
    Object.keys(errors).forEach(key => {
      delete errors[key]
    })
    Object.keys(touched).forEach(key => {
      touched[key] = false
    })
    isValid.value = true
  }
  
  return {
    values,
    errors,
    touched,
    isSubmitting,
    isValid,
    handleSubmit,
    handleChange,
    handleBlur,
    resetForm,
    validateForm
  }
}