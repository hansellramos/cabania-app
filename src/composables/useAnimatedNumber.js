import { ref, watch } from 'vue'

/**
 * Animates a number from its previous value to the new target.
 * @param {import('vue').Ref<number>} target - reactive ref with the target number
 * @param {object} opts - { duration: ms, formatter: (n) => string }
 * @returns {import('vue').Ref<string>} displayed value (formatted)
 */
export function useAnimatedNumber(target, opts = {}) {
  const { duration = 800, formatter = (n) => String(n) } = opts
  const current = ref(0)
  const displayed = ref(formatter(0))

  watch(target, (newVal) => {
    const end = Number(newVal) || 0
    const start = current.value
    if (start === end) { displayed.value = formatter(end); return }

    const startTime = performance.now()
    function step(now) {
      const progress = Math.min((now - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // easeOutCubic
      const val = Math.round(start + (end - start) * eased)
      current.value = val
      displayed.value = formatter(val)
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, { immediate: true })

  return displayed
}
