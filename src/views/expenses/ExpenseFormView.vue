<template>
  <CRow>
    <CCol :xs="12" :lg="8">
      <CCard class="mb-4">
        <CCardHeader class="d-flex justify-content-between align-items-center">
          <strong>{{ isEditing ? 'Editar Gasto' : 'Nuevo Gasto' }}</strong>
          <CButton color="secondary" size="sm" variant="outline" @click="goBack">
            Cancelar
          </CButton>
        </CCardHeader>
        <CCardBody>
          <CForm @submit.prevent="saveExpense">
            <CRow class="mb-3">
              <CCol :md="6">
                <CFormLabel>Organización *</CFormLabel>
                <template v-if="lockedOrganization">
                  <div class="form-control-plaintext">
                    <CBadge color="secondary" class="fs-6 py-2 px-3">
                      <CIcon name="cil-building" class="me-1" />
                      {{ lockedOrganization.name }}
                    </CBadge>
                  </div>
                </template>
                <template v-else>
                  <CFormSelect v-model="form.organization_id" required>
                    <option value="">Seleccionar...</option>
                    <option v-for="org in organizations" :key="org.id" :value="org.id">
                      {{ org.name }}
                    </option>
                  </CFormSelect>
                </template>
              </CCol>
              <CCol :md="6">
                <CFormLabel>Sede *</CFormLabel>
                <template v-if="lockedVenue">
                  <div class="form-control-plaintext">
                    <RouterLink :to="`/business/venues/${lockedVenue.id}/read`" class="text-decoration-none">
                      <CBadge color="warning" class="fs-6 py-2 px-3">
                        <CIcon name="cil-location-pin" class="me-1" />
                        {{ lockedVenue.name }}
                        <CIcon name="cil-external-link" size="sm" class="ms-1" />
                      </CBadge>
                    </RouterLink>
                  </div>
                </template>
                <template v-else>
                  <CFormSelect v-model="form.venue_id" required>
                    <option value="">Seleccionar...</option>
                    <option v-for="venue in filteredVenues" :key="venue.id" :value="venue.id">
                      {{ venue.name }}
                    </option>
                  </CFormSelect>
                </template>
              </CCol>
            </CRow>
            <CAlert v-if="!form.venue_id" color="info" class="mt-3">
              <CIcon name="cil-info" class="me-2" />
              Seleccione una organización y sede para continuar registrando el gasto.
            </CAlert>
            <template v-if="form.venue_id">
            <CRow class="mb-3" v-if="accommodations.length > 0 || lockedAccommodation">
              <CCol :md="12">
                <CFormLabel>Hospedaje (opcional)</CFormLabel>
                <template v-if="lockedAccommodation">
                  <div class="form-control-plaintext">
                    <RouterLink :to="`/business/accommodations/${lockedAccommodation.id}`" class="text-decoration-none">
                      <CBadge color="info" class="fs-6 py-2 px-3">
                        <CIcon name="cil-calendar" class="me-1" />
                        {{ formatAccommodationLabel(lockedAccommodation) }}
                        <CIcon name="cil-external-link" size="sm" class="ms-1" />
                      </CBadge>
                    </RouterLink>
                  </div>
                </template>
                <template v-else>
                  <CFormSelect v-model="form.accommodation_id">
                    <option value="">Sin hospedaje asociado</option>
                    <option v-for="acc in accommodations" :key="acc.id" :value="acc.id">
                      {{ formatAccommodationLabel(acc) }}
                    </option>
                  </CFormSelect>
                </template>
              </CCol>
            </CRow>
            <CRow class="mb-3">
              <CCol :md="4">
                <CFormLabel>Categoría *</CFormLabel>
                <CFormSelect v-model="form.category_id" required @change="onCategoryChange">
                  <option value="">Seleccionar...</option>
                  <option v-for="category in categories" :key="category.id" :value="category.id">
                    {{ category.name }}
                  </option>
                </CFormSelect>
                <div v-if="selectedCategory" class="mt-2">
                  <CBadge :color="selectedCategory.color || 'primary'">
                    <CIcon v-if="selectedCategory.icon" :name="selectedCategory.icon" class="me-1" />
                    {{ selectedCategory.name }}
                  </CBadge>
                </div>
              </CCol>
              <CCol :md="4">
                <CFormLabel>Subcategoría</CFormLabel>
                <CFormSelect v-model="form.subcategory" :disabled="!subcategoryOptions.length">
                  <option value="">{{ subcategoryOptions.length ? 'Seleccionar...' : 'N/A para esta categoría' }}</option>
                  <option v-for="sub in subcategoryOptions" :key="sub" :value="sub">
                    {{ sub }}
                  </option>
                </CFormSelect>
              </CCol>
              <CCol :md="4">
                <CFormLabel>Fecha del gasto *</CFormLabel>
                <CFormInput type="date" v-model="form.expense_date" required />
              </CCol>
            </CRow>
            <CRow class="mb-3">
              <CCol :md="4">
                <CFormLabel>Monto *</CFormLabel>
                <CFormInput 
                  type="number" 
                  v-model="form.amount" 
                  placeholder="0"
                  required
                />
              </CCol>
              <CCol :md="4">
                <CFormLabel>Referencia</CFormLabel>
                <CFormInput 
                  v-model="form.reference" 
                  placeholder="Ej: Factura #12345"
                />
              </CCol>
              <CCol :md="4">
                <CFormLabel>Proveedor</CFormLabel>
                <div class="position-relative">
                  <CFormInput 
                    v-model="providerSearch"
                    placeholder="Buscar o crear proveedor..."
                    @input="searchProviders"
                    @focus="showProviderSuggestions = true"
                    @blur="hideProviderSuggestions"
                    autocomplete="off"
                  />
                  <div 
                    v-if="showProviderSuggestions && (providerSuggestions.length > 0 || (providerSearch && providerSearch.length >= 2))"
                    class="provider-suggestions"
                  >
                    <div 
                      v-for="provider in providerSuggestions" 
                      :key="provider.id"
                      class="provider-suggestion"
                      @mousedown="selectProvider(provider)"
                    >
                      {{ provider.name }}
                    </div>
                    <div 
                      v-if="providerSearch && providerSearch.length >= 2 && !providerSuggestions.some(p => p.name.toLowerCase() === providerSearch.toLowerCase())"
                      class="provider-suggestion provider-create"
                      @mousedown="createAndSelectProvider"
                    >
                      <CIcon name="cil-plus" class="me-1" />
                      Crear "{{ providerSearch }}"
                    </div>
                  </div>
                </div>
                <div v-if="selectedProvider" class="mt-2">
                  <CBadge color="info">
                    <CIcon name="cil-user" class="me-1" />
                    {{ selectedProvider.name }}
                    <CIcon name="cil-x" size="sm" class="ms-1 cursor-pointer" @click="clearProvider" />
                  </CBadge>
                </div>
              </CCol>
            </CRow>
            <CRow class="mb-3">
              <CCol :md="12">
                <CFormLabel>Descripción</CFormLabel>
                <CFormTextarea 
                  v-model="form.description" 
                  rows="2"
                  placeholder="Descripción del gasto..."
                />
              </CCol>
            </CRow>
            <CRow class="mb-3">
              <CCol :md="12">
                <CFormLabel>Notas</CFormLabel>
                <CFormTextarea 
                  v-model="form.notes" 
                  rows="2"
                  placeholder="Notas adicionales..."
                />
              </CCol>
            </CRow>
            <!-- Inventory Items Section -->
            <template v-if="isEditing || pendingInventoryItems.length > 0 || showSuggestedItems">
              <hr class="my-4" />
              <h6 class="mb-3">
                <CIcon name="cil-clipboard" class="me-2" />
                Items de Inventario (Compras)
              </h6>
              <div v-if="isEditing" class="mb-3">
                <CRow class="g-2 align-items-end">
                  <CCol :md="5">
                    <CFormLabel>Item de Inventario</CFormLabel>
                    <CFormSelect v-model="newInventoryItemId">
                      <option value="">Seleccionar item...</option>
                      <option v-for="item in availableInventoryItems" :key="item.id" :value="item.id">
                        {{ item.name }} ({{ item.quantity }} {{ item.unit || 'und' }})
                      </option>
                    </CFormSelect>
                  </CCol>
                  <CCol :md="3">
                    <CFormLabel>Cantidad</CFormLabel>
                    <CFormInput type="number" v-model="newInventoryQty" placeholder="0" min="0.01" step="0.01" />
                  </CCol>
                  <CCol :md="2">
                    <CFormLabel>Costo Unit.</CFormLabel>
                    <CFormInput type="number" v-model="newInventoryUnitCost" placeholder="0" min="0" step="0.01" />
                  </CCol>
                  <CCol :md="2">
                    <CButton color="success" size="sm" class="w-100" @click="addExpenseInventoryItem" :disabled="!newInventoryItemId || !newInventoryQty">
                      <CIcon name="cil-plus" class="me-1" /> Agregar
                    </CButton>
                  </CCol>
                </CRow>
              </div>
              <!-- Existing linked items (edit mode) -->
              <div v-if="expenseInventoryItems.length > 0" class="table-responsive mb-3">
                <table class="table table-sm table-bordered align-middle">
                  <thead class="table-light">
                    <tr>
                      <th>Item</th>
                      <th class="text-end">Cantidad</th>
                      <th class="text-end">Costo Unit.</th>
                      <th class="text-end">Subtotal</th>
                      <th style="width: 50px;"></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="ei in expenseInventoryItems" :key="ei.id">
                      <td>
                        {{ ei.inventory_item?.name || 'N/A' }}
                        <span v-if="ei.inventory_item?.unit" class="text-muted small">({{ ei.inventory_item.unit }})</span>
                      </td>
                      <td class="text-end">{{ ei.quantity }}</td>
                      <td class="text-end">{{ ei.unit_cost ? formatCurrency(ei.unit_cost) : '-' }}</td>
                      <td class="text-end">{{ ei.unit_cost ? formatCurrency(ei.quantity * ei.unit_cost) : '-' }}</td>
                      <td class="text-center">
                        <CButton color="danger" size="sm" variant="ghost" @click="removeExpenseInventoryItem(ei.id)">
                          <CIcon name="cil-trash" />
                        </CButton>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <!-- Pending items (create mode - will be saved with expense) -->
              <div v-if="pendingInventoryItems.length > 0" class="mb-3">
                <CAlert color="info" class="py-2">
                  <CIcon name="cil-info" class="me-1" />
                  {{ pendingInventoryItems.length }} item(s) se agregarán al guardar el gasto.
                </CAlert>
                <table class="table table-sm table-bordered align-middle">
                  <thead class="table-light">
                    <tr>
                      <th>Item</th>
                      <th class="text-end">Cantidad</th>
                      <th class="text-end">Costo Unit.</th>
                      <th class="text-end">Subtotal</th>
                      <th style="width: 50px;"></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(pi, idx) in pendingInventoryItems" :key="idx">
                      <td>{{ pi.name }} <span class="text-muted small">({{ pi.unit || 'und' }})</span></td>
                      <td class="text-end">{{ pi.quantity }}</td>
                      <td class="text-end">{{ pi.unit_cost ? formatCurrency(pi.unit_cost) : '-' }}</td>
                      <td class="text-end">{{ pi.unit_cost ? formatCurrency(pi.quantity * pi.unit_cost) : '-' }}</td>
                      <td class="text-center">
                        <CButton color="danger" size="sm" variant="ghost" @click="pendingInventoryItems.splice(idx, 1)">
                          <CIcon name="cil-trash" />
                        </CButton>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-if="!expenseInventoryItems.length && !pendingInventoryItems.length" class="text-muted small mb-3">
                No hay items de inventario vinculados a este gasto.
              </div>
            </template>

            <CRow class="mb-3">
              <CCol :md="12">
                <CFormLabel>Comprobante</CFormLabel>
                <div 
                  v-if="!form.receipt_url"
                  class="receipt-upload-area"
                  :class="{ 'is-dragging': isDragging, 'is-uploading': uploading }"
                  @paste="handlePaste"
                  @drop.prevent="handleDrop"
                  @dragover.prevent="isDragging = true"
                  @dragleave="isDragging = false"
                  @click="triggerFileInput"
                  tabindex="0"
                >
                  <div v-if="uploading" class="text-center">
                    <CSpinner size="sm" class="me-2" />
                    Subiendo imagen...
                  </div>
                  <div v-else class="text-center">
                    <CIcon name="cil-cloud-upload" size="xl" class="mb-2 text-secondary" />
                    <div class="mb-2">Arrastrar imagen aquí o Ctrl+V para pegar</div>
                    <div class="d-flex justify-content-center gap-2 flex-wrap">
                      <CButton color="primary" size="sm" @click.stop="triggerFileInput">
                        <CIcon name="cil-folder-open" class="me-1" /> Seleccionar archivo
                      </CButton>
                      <CButton color="info" size="sm" @click.stop="triggerCamera">
                        <CIcon name="cil-camera" class="me-1" /> Tomar Foto
                      </CButton>
                      <CButton color="secondary" size="sm" @click.stop="pasteFromClipboard">
                        <CIcon name="cil-clipboard" class="me-1" /> Pegar
                      </CButton>
                    </div>
                  </div>
                  <input
                    ref="fileInput"
                    type="file"
                    accept="image/*"
                    class="d-none"
                    @change="handleFileSelect"
                  />
                  <input
                    ref="cameraInput"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    class="d-none"
                    @change="handleFileSelect"
                  />
                </div>
                <div v-if="uploadError" class="text-danger small mt-2">
                  {{ uploadError }}
                </div>
                <div v-if="form.receipt_url" class="mt-2">
                  <div class="position-relative d-inline-block">
                    <img 
                      v-if="!imageLoadError"
                      :src="form.receipt_url" 
                      class="img-thumbnail" 
                      style="max-height: 200px; cursor: pointer;"
                      @click="showReceiptModal = true"
                      @error="handleImageError"
                    />
                    <div 
                      v-else
                      class="receipt-placeholder"
                      @click="showReceiptModal = true"
                    >
                      <CIcon name="cil-image" size="xl" class="text-secondary mb-2" />
                      <div class="small text-muted">Imagen no disponible</div>
                    </div>
                    <CButton 
                      color="danger" 
                      size="sm" 
                      class="position-absolute top-0 end-0 m-1"
                      @click.stop="deleteReceipt"
                    >
                      <CIcon name="cil-x" />
                    </CButton>
                  </div>
                  <div class="mt-2">
                    <CButton 
                      color="info" 
                      size="sm"
                      :disabled="extractingData"
                      @click="extractReceiptData"
                    >
                      <CSpinner v-if="extractingData" size="sm" class="me-2" />
                      <CIcon v-else name="cil-lightbulb" class="me-2" />
                      {{ extractingData ? 'Leyendo comprobante...' : 'Leer con IA' }}
                    </CButton>
                    <span v-if="extractionError" class="text-danger small ms-2">{{ extractionError }}</span>
                    <span v-if="extractionSuccess" class="text-success small ms-2">Datos extraídos correctamente</span>
                  </div>
                </div>
              </CCol>
            </CRow>

            <!-- AI Suggested Items Panel -->
            <CCard v-if="showSuggestedItems && suggestedItems.length > 0" class="mb-3 border-info">
              <CCardHeader class="d-flex justify-content-between align-items-center bg-info bg-opacity-10">
                <span>
                  <CIcon name="cil-lightbulb" class="me-2" />
                  <strong>Items detectados por IA</strong>
                  <CBadge color="info" class="ms-2">{{ suggestedItems.length }}</CBadge>
                </span>
                <CButton color="light" size="sm" @click="showSuggestedItems = false">
                  <CIcon name="cil-x" />
                </CButton>
              </CCardHeader>
              <CCardBody class="p-0">
                <div class="table-responsive">
                  <table class="table table-sm align-middle mb-0">
                    <thead class="table-light">
                      <tr>
                        <th>Item del Recibo</th>
                        <th class="text-end">Cant.</th>
                        <th class="text-end">P. Unit.</th>
                        <th class="text-end">Subtotal</th>
                        <th>Coincidencia</th>
                        <th style="width: 100px;">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(item, index) in suggestedItems" :key="index" :class="{ 'table-success': item.added }">
                        <td>
                          <template v-if="item.editing">
                            <CFormInput v-model="item.name" size="sm" />
                          </template>
                          <template v-else>{{ item.name }}</template>
                        </td>
                        <td class="text-end">
                          <template v-if="item.editing">
                            <CFormInput v-model.number="item.quantity" type="number" size="sm" min="0" step="1" style="width: 70px;" class="ms-auto" />
                          </template>
                          <template v-else>{{ item.quantity }}</template>
                        </td>
                        <td class="text-end">
                          <template v-if="item.editing">
                            <CFormInput v-model.number="item.unit_cost" type="number" size="sm" min="0" step="0.01" style="width: 100px;" class="ms-auto" />
                          </template>
                          <template v-else>{{ item.unit_cost ? formatCurrency(item.unit_cost) : '-' }}</template>
                        </td>
                        <td class="text-end">
                          <template v-if="item.editing">
                            <CFormInput v-model.number="item.subtotal" type="number" size="sm" min="0" step="0.01" style="width: 100px;" class="ms-auto" />
                          </template>
                          <template v-else>{{ item.subtotal ? formatCurrency(item.subtotal) : '-' }}</template>
                        </td>
                        <td>
                          <CBadge v-if="item.matched_inventory_name" :color="confidenceColor(item.confidence)">
                            {{ item.matched_inventory_name }}
                          </CBadge>
                          <span v-else class="text-muted small">Sin coincidencia</span>
                        </td>
                        <td>
                          <div class="d-flex gap-1">
                            <template v-if="item.added">
                              <CIcon name="cil-check-circle" class="text-success mt-1" />
                            </template>
                            <template v-else-if="item.editing">
                              <CButton color="success" size="sm" variant="ghost" @click="item.editing = false" title="Listo">
                                <CIcon name="cil-check" />
                              </CButton>
                            </template>
                            <template v-else>
                              <CButton v-if="item.matched_inventory_id" color="success" size="sm" variant="ghost" @click="acceptSuggestedItem(index)" title="Agregar">
                                <CIcon name="cil-plus" />
                              </CButton>
                              <CButton v-else color="warning" size="sm" variant="ghost" @click="openCreateInventoryItem(index)" title="Crear">
                                <CIcon name="cil-library-add" />
                              </CButton>
                              <CButton color="info" size="sm" variant="ghost" @click="item.editing = true" title="Editar">
                                <CIcon name="cil-pencil" />
                              </CButton>
                            </template>
                            <CButton v-if="!item.added" color="danger" size="sm" variant="ghost" @click="removeSuggestedItem(index)" title="Eliminar">
                              <CIcon name="cil-trash" />
                            </CButton>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CCardBody>
              <CCardFooter v-if="suggestedItems.some(i => i.matched_inventory_id && !i.added)" class="bg-info bg-opacity-10">
                <CButton color="info" size="sm" @click="acceptAllMatchedItems">
                  <CIcon name="cil-check-circle" class="me-1" />
                  Agregar todos los coincidentes
                </CButton>
              </CCardFooter>
            </CCard>

            <div class="d-flex justify-content-end gap-2">
              <CButton color="secondary" variant="outline" @click="goBack">
                Cancelar
              </CButton>
              <CButton type="submit" color="primary" :disabled="saving">
                {{ saving ? 'Guardando...' : (isEditing ? 'Actualizar' : 'Guardar') }}
              </CButton>
            </div>
            </template>
          </CForm>
        </CCardBody>
      </CCard>
    </CCol>
  </CRow>

  <CModal 
    :visible="showReceiptModal" 
    @close="showReceiptModal = false" 
    size="xl"
  >
    <CModalHeader close-button>
      <CModalTitle>Comprobante</CModalTitle>
    </CModalHeader>
    <CModalBody class="text-center p-4">
      <img :src="form.receipt_url" class="img-fluid rounded" style="max-height: 70vh;" />
    </CModalBody>
    <CModalFooter class="justify-content-center">
      <CButton color="danger" @click="deleteReceipt">
        <CIcon name="cil-trash" class="me-2" />
        Eliminar comprobante
      </CButton>
      <CButton color="secondary" variant="outline" @click="showReceiptModal = false">
        Cerrar
      </CButton>
    </CModalFooter>
  </CModal>

  <!-- Create Inventory Item Modal -->
  <CModal
    :visible="showCreateInventoryModal"
    @close="showCreateInventoryModal = false"
    size="md"
  >
    <CModalHeader close-button>
      <CModalTitle>Crear Item de Inventario</CModalTitle>
    </CModalHeader>
    <CModalBody>
      <CRow class="mb-3">
        <CCol :md="12">
          <CFormLabel>Nombre *</CFormLabel>
          <CFormInput v-model="newInventoryItemData.name" placeholder="Nombre del item" />
        </CCol>
      </CRow>
      <CRow class="mb-3">
        <CCol :md="6">
          <CFormLabel>Unidad</CFormLabel>
          <CFormSelect v-model="newInventoryItemData.unit">
            <option value="">Seleccionar...</option>
            <option value="und">Unidad</option>
            <option value="kg">Kilogramo</option>
            <option value="lb">Libra</option>
            <option value="lt">Litro</option>
            <option value="gl">Galón</option>
            <option value="mt">Metro</option>
            <option value="paq">Paquete</option>
            <option value="caja">Caja</option>
          </CFormSelect>
        </CCol>
        <CCol :md="6">
          <CFormLabel>Costo Unitario</CFormLabel>
          <CFormInput type="number" v-model="newInventoryItemData.unit_cost" placeholder="0" min="0" step="0.01" />
        </CCol>
      </CRow>
      <CRow class="mb-3">
        <CCol :md="12">
          <CFormLabel>Descripción</CFormLabel>
          <CFormTextarea v-model="newInventoryItemData.description" rows="2" placeholder="Descripción opcional..." />
        </CCol>
      </CRow>
    </CModalBody>
    <CModalFooter>
      <CButton color="secondary" variant="outline" @click="showCreateInventoryModal = false">
        Cancelar
      </CButton>
      <CButton color="primary" @click="createInventoryItemAndLink" :disabled="!newInventoryItemData.name">
        Crear y Agregar
      </CButton>
    </CModalFooter>
  </CModal>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  CRow, CCol, CCard, CCardHeader, CCardBody, CCardFooter, CButton,
  CForm, CFormLabel, CFormInput, CFormTextarea, CFormSelect,
  CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter,
  CAlert, CBadge, CSpinner, CTable, CTableHead, CTableRow, CTableHeaderCell, CTableBody, CTableDataCell
} from '@coreui/vue'
import { CIcon } from '@coreui/icons-vue'

const route = useRoute()
const router = useRouter()

const isEditing = computed(() => route.params.id && route.params.id !== 'new')
const organizations = ref([])
const venues = ref([])
const categories = ref([])
const saving = ref(false)
const showReceiptModal = ref(false)
const fileInput = ref(null)
const cameraInput = ref(null)
const isDragging = ref(false)
const uploading = ref(false)
const extractingData = ref(false)
const extractionError = ref('')
const extractionSuccess = ref(false)
const uploadError = ref('')
const imageLoadError = ref(false)

// AI suggestion state
const suggestedItems = ref([])
const showSuggestedItems = ref(false)
const pendingInventoryItems = ref([])
const showCreateInventoryModal = ref(false)
const newInventoryItemData = ref({ name: '', unit: '', unit_cost: '', description: '' })
const createInventoryIndex = ref(-1)

const form = ref({
  organization_id: '',
  venue_id: '',
  accommodation_id: '',
  category_id: '',
  subcategory: '',
  provider_id: '',
  amount: '',
  expense_date: new Date().toISOString().split('T')[0],
  description: '',
  reference: '',
  receipt_url: '',
  notes: ''
})

// Accommodation selector
const accommodations = ref([])
const lockedAccommodation = computed(() => {
  if (route.query.accommodation_id && !isEditing.value) {
    return accommodations.value.find(a => a.id === route.query.accommodation_id)
  }
  return null
})

const providerSearch = ref('')
const providerSuggestions = ref([])
const showProviderSuggestions = ref(false)
const selectedProvider = ref(null)

const subcategoryMap = {
  'Servicios': ['Internet/Tv', 'Agua', 'Energía', 'Gas', 'Aseo'],
  'Mantenimiento': ['Piscina', 'Equipos', 'Eléctrico', 'Aires Acondicionados', 'Kiosco']
}

const subcategoryOptions = computed(() => {
  if (!selectedCategory.value) return []
  return subcategoryMap[selectedCategory.value.name] || []
})

const filteredVenues = computed(() => {
  if (!form.value.organization_id) return venues.value
  return venues.value.filter(v => String(v.organization) === String(form.value.organization_id))
})

const lockedVenue = computed(() => {
  if (route.query.venue_id && !isEditing.value) {
    return venues.value.find(v => String(v.id) === String(route.query.venue_id))
  }
  return null
})

const lockedOrganization = computed(() => {
  if (lockedVenue.value && lockedVenue.value.organization) {
    return organizations.value.find(o => String(o.id) === String(lockedVenue.value.organization))
  }
  return null
})

const selectedCategory = computed(() => {
  return categories.value.find(c => c.id === form.value.category_id)
})

watch(() => form.value.venue_id, (newVenueId) => {
  if (newVenueId && !lockedVenue.value) {
    const venue = venues.value.find(v => String(v.id) === String(newVenueId))
    if (venue && venue.organization && !form.value.organization_id) {
      form.value.organization_id = venue.organization
    }
  }
})

const goBack = () => {
  if (route.query.accommodation_id) {
    router.push(`/business/accommodations/${route.query.accommodation_id}`)
  } else {
    router.push('/business/expenses')
  }
}

const onCategoryChange = () => {
  form.value.subcategory = ''
}

const searchProviders = async () => {
  if (!providerSearch.value || providerSearch.value.length < 2) {
    providerSuggestions.value = []
    return
  }
  
  try {
    const params = new URLSearchParams({ search: providerSearch.value })
    if (form.value.organization_id) {
      params.append('organization_id', form.value.organization_id)
    }
    const response = await fetch(`/api/providers?${params}`, { credentials: 'include' })
    if (response.ok) {
      providerSuggestions.value = await response.json()
    }
  } catch (error) {
    console.error('Error searching providers:', error)
  }
}

const selectProvider = (provider) => {
  selectedProvider.value = provider
  form.value.provider_id = provider.id
  providerSearch.value = ''
  showProviderSuggestions.value = false
  providerSuggestions.value = []
}

const createAndSelectProvider = async () => {
  if (!providerSearch.value || providerSearch.value.length < 2) return
  
  try {
    const response = await fetch('/api/providers/find-or-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        name: providerSearch.value,
        organization_id: form.value.organization_id || null
      })
    })
    
    if (response.ok) {
      const provider = await response.json()
      selectProvider(provider)
    }
  } catch (error) {
    console.error('Error creating provider:', error)
  }
}

const clearProvider = () => {
  selectedProvider.value = null
  form.value.provider_id = ''
  providerSearch.value = ''
}

const hideProviderSuggestions = () => {
  setTimeout(() => {
    showProviderSuggestions.value = false
  }, 200)
}

// --- Inventory Items linked to expense ---
const expenseInventoryItems = ref([])
const availableInventoryItems = ref([])
const newInventoryItemId = ref('')
const newInventoryQty = ref('')
const newInventoryUnitCost = ref('')

const formatCurrency = (value) => {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value)
}

const loadExpenseInventoryItems = async () => {
  if (!isEditing.value) return
  try {
    const response = await fetch(`/api/expenses/${route.params.id}/inventory-items`, { credentials: 'include' })
    if (response.ok) {
      expenseInventoryItems.value = await response.json()
    }
  } catch (error) {
    console.error('Error loading expense inventory items:', error)
  }
}

const loadAvailableInventory = async () => {
  try {
    const params = new URLSearchParams({ type: 'supply' })
    if (form.value.venue_id) params.append('venue_id', form.value.venue_id)
    const response = await fetch(`/api/inventory?${params}`, { credentials: 'include' })
    if (response.ok) {
      availableInventoryItems.value = await response.json()
    }
  } catch (error) {
    console.error('Error loading inventory items:', error)
  }
}

const addExpenseInventoryItem = async () => {
  if (!newInventoryItemId.value || !newInventoryQty.value) return
  try {
    const response = await fetch(`/api/expenses/${route.params.id}/inventory-items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        inventory_item_id: newInventoryItemId.value,
        quantity: parseFloat(newInventoryQty.value),
        unit_cost: newInventoryUnitCost.value ? parseFloat(newInventoryUnitCost.value) : null,
      })
    })
    if (response.ok) {
      newInventoryItemId.value = ''
      newInventoryQty.value = ''
      newInventoryUnitCost.value = ''
      await Promise.all([loadExpenseInventoryItems(), loadAvailableInventory()])
    } else {
      const error = await response.json()
      alert(error.error || 'Error al agregar item de inventario')
    }
  } catch (error) {
    console.error('Error adding inventory item:', error)
  }
}

const removeExpenseInventoryItem = async (id) => {
  if (!confirm('¿Eliminar este item? Se revertirá el stock agregado.')) return
  try {
    const response = await fetch(`/api/expense-inventory-items/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    })
    if (response.ok) {
      await Promise.all([loadExpenseInventoryItems(), loadAvailableInventory()])
    } else {
      const error = await response.json()
      alert(error.error || 'Error al eliminar item')
    }
  } catch (error) {
    console.error('Error removing inventory item:', error)
  }
}

// --- AI suggestion actions ---
const confidenceColor = (confidence) => {
  if (confidence === 'high') return 'success'
  if (confidence === 'medium') return 'warning'
  return 'secondary'
}

const acceptSuggestedItem = async (index) => {
  const item = suggestedItems.value[index]
  if (!item || item.added || !item.matched_inventory_id) return

  if (isEditing.value) {
    // Edit mode: POST directly to API
    try {
      const response = await fetch(`/api/expenses/${route.params.id}/inventory-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          inventory_item_id: item.matched_inventory_id,
          quantity: item.quantity || 1,
          unit_cost: item.unit_cost || null,
        })
      })
      if (response.ok) {
        suggestedItems.value[index].added = true
        await Promise.all([loadExpenseInventoryItems(), loadAvailableInventory()])
      } else {
        const err = await response.json()
        alert(err.error || 'Error al agregar item')
      }
    } catch (error) {
      console.error('Error adding suggested item:', error)
    }
  } else {
    // Create mode: add to pending
    const alreadyPending = pendingInventoryItems.value.some(
      p => p.inventory_item_id === item.matched_inventory_id
    )
    if (!alreadyPending) {
      pendingInventoryItems.value.push({
        inventory_item_id: item.matched_inventory_id,
        name: item.matched_inventory_name || item.name,
        unit: item.unit || 'und',
        quantity: item.quantity || 1,
        unit_cost: item.unit_cost || null,
      })
    }
    suggestedItems.value[index].added = true
  }
}

const acceptAllMatchedItems = async () => {
  for (let i = 0; i < suggestedItems.value.length; i++) {
    const item = suggestedItems.value[i]
    if (item.matched_inventory_id && !item.added) {
      await acceptSuggestedItem(i)
    }
  }
}

const removeSuggestedItem = (index) => {
  suggestedItems.value.splice(index, 1)
  if (suggestedItems.value.length === 0) {
    showSuggestedItems.value = false
  }
}

const openCreateInventoryItem = (index) => {
  const item = suggestedItems.value[index]
  createInventoryIndex.value = index
  newInventoryItemData.value = {
    name: item.name || '',
    unit: '',
    unit_cost: item.unit_cost || '',
    description: ''
  }
  showCreateInventoryModal.value = true
}

const createInventoryItemAndLink = async () => {
  if (!newInventoryItemData.value.name) return

  try {
    // Create inventory item
    const response = await fetch('/api/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        name: newInventoryItemData.value.name,
        unit: newInventoryItemData.value.unit || 'und',
        unit_cost: newInventoryItemData.value.unit_cost ? parseFloat(newInventoryItemData.value.unit_cost) : null,
        description: newInventoryItemData.value.description || '',
        venue_id: form.value.venue_id,
        type: 'supply',
        quantity: 0,
      })
    })

    if (!response.ok) {
      const err = await response.json()
      alert(err.error || 'Error al crear item de inventario')
      return
    }

    const newItem = await response.json()

    // Update the suggested item with the new inventory ID
    if (createInventoryIndex.value >= 0) {
      suggestedItems.value[createInventoryIndex.value].matched_inventory_id = newItem.id
      suggestedItems.value[createInventoryIndex.value].matched_inventory_name = newItem.name
      suggestedItems.value[createInventoryIndex.value].confidence = 'high'
      // Auto-add it
      await acceptSuggestedItem(createInventoryIndex.value)
    }

    // Reload inventory list
    await loadAvailableInventory()

    showCreateInventoryModal.value = false
    createInventoryIndex.value = -1
  } catch (error) {
    console.error('Error creating inventory item:', error)
    alert('Error al crear item de inventario')
  }
}

const loadAccommodations = async () => {
  if (!form.value.venue_id) {
    accommodations.value = []
    return
  }
  try {
    const response = await fetch(`/api/accommodations?venue_ids=${form.value.venue_id}`, { credentials: 'include' })
    if (response.ok) {
      accommodations.value = await response.json()
    }
  } catch (error) {
    console.error('Error loading accommodations:', error)
  }
}

const formatAccommodationLabel = (acc) => {
  const date = acc.date ? new Date(acc.date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : ''
  const customer = acc.customer_data?.fullname || ''
  return `${date}${customer ? ' - ' + customer : ''}`
}

const loadOrganizations = async () => {
  try {
    const response = await fetch('/api/organizations', { credentials: 'include' })
    if (response.ok) {
      organizations.value = await response.json()
    }
  } catch (error) {
    console.error('Error loading organizations:', error)
  }
}

const loadVenues = async () => {
  try {
    const response = await fetch('/api/venues', { credentials: 'include' })
    if (response.ok) {
      venues.value = await response.json()
    }
  } catch (error) {
    console.error('Error loading venues:', error)
  }
}

const loadCategories = async () => {
  try {
    const response = await fetch('/api/expense-categories', { credentials: 'include' })
    if (response.ok) {
      categories.value = await response.json()
    }
  } catch (error) {
    console.error('Error loading categories:', error)
  }
}

const loadExpense = async () => {
  if (!isEditing.value) return
  try {
    const response = await fetch(`/api/expenses/${route.params.id}`, { credentials: 'include' })
    if (response.ok) {
      const expense = await response.json()
      form.value = {
        organization_id: expense.organization_id || '',
        venue_id: expense.venue_id || '',
        accommodation_id: expense.accommodation_id || '',
        category_id: expense.category_id || '',
        subcategory: expense.subcategory || '',
        provider_id: expense.provider_id || '',
        amount: expense.amount || '',
        expense_date: expense.expense_date ? expense.expense_date.split('T')[0] : '',
        description: expense.description || '',
        reference: expense.reference || '',
        receipt_url: expense.receipt_url || '',
        notes: expense.notes || ''
      }
      if (expense.provider) {
        selectedProvider.value = expense.provider
      }
    }
  } catch (error) {
    console.error('Error loading expense:', error)
  }
}

const handleImageError = () => {
  imageLoadError.value = true
}

const deleteReceipt = () => {
  form.value.receipt_url = ''
  imageLoadError.value = false
  showReceiptModal.value = false
}

const triggerFileInput = () => {
  fileInput.value?.click()
}

const triggerCamera = () => {
  cameraInput.value?.click()
}

const handleFileSelect = (e) => {
  const file = e.target.files?.[0]
  if (file) uploadFile(file)
}

const handlePaste = (e) => {
  const items = e.clipboardData?.items
  if (!items) return
  
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) uploadFile(file)
      break
    }
  }
}

const pasteFromClipboard = async () => {
  try {
    const clipboardItems = await navigator.clipboard.read()
    for (const clipboardItem of clipboardItems) {
      for (const type of clipboardItem.types) {
        if (type.startsWith('image/')) {
          const blob = await clipboardItem.getType(type)
          const file = new File([blob], 'pasted-image.png', { type })
          uploadFile(file)
          return
        }
      }
    }
    uploadError.value = 'No se encontró imagen en el portapapeles'
  } catch (error) {
    console.error('Error reading clipboard:', error)
    uploadError.value = 'No se pudo acceder al portapapeles. Intenta con Ctrl+V'
  }
}

const extractReceiptData = async () => {
  if (!form.value.receipt_url) return

  extractingData.value = true
  extractionError.value = ''
  extractionSuccess.value = false
  suggestedItems.value = []
  showSuggestedItems.value = false

  try {
    const response = await fetch('/api/expenses/analyze-receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        imageUrl: form.value.receipt_url,
        categories: categories.value.map(c => ({ id: c.id, name: c.name })),
        subcategoryMap,
        inventoryItems: availableInventoryItems.value.map(i => ({ id: i.id, name: i.name, unit: i.unit || 'und' })),
        organization_id: form.value.organization_id || null
      })
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || 'Error al procesar comprobante')
    }

    if (result.success && result.data) {
      const { amount, reference, expense_date, category_id, subcategory, description, line_items, matched_provider_id, matched_provider_name, provider_name } = result.data

      // Fill basic fields only if empty
      if (amount !== null && (!form.value.amount || Number(form.value.amount) === 0)) {
        form.value.amount = amount
      }
      if (reference && !form.value.reference) {
        form.value.reference = reference
      }
      if (expense_date && !form.value.expense_date) {
        form.value.expense_date = expense_date
      }
      if (description && !form.value.description) {
        form.value.description = description
      }

      // Auto-select category if empty and AI found a valid one
      if (category_id && !form.value.category_id) {
        const matchedCat = categories.value.find(c => c.id === category_id)
        if (matchedCat) {
          form.value.category_id = category_id
          // Auto-select subcategory too
          if (subcategory) {
            const validSubs = subcategoryMap[matchedCat.name] || []
            if (validSubs.includes(subcategory)) {
              form.value.subcategory = subcategory
            }
          }
        }
      }

      // Auto-select or pre-fill provider if not already set
      if (!form.value.provider_id) {
        if (matched_provider_id) {
          selectProvider({ id: matched_provider_id, name: matched_provider_name })
        } else if (provider_name) {
          providerSearch.value = provider_name
          showProviderSuggestions.value = false
        }
      }

      // Process line items
      if (line_items && line_items.length > 0) {
        // Filter out items already linked to this expense
        const existingIds = new Set(expenseInventoryItems.value.map(ei => ei.inventory_item_id))
        suggestedItems.value = line_items.map(item => ({
          ...item,
          added: existingIds.has(item.matched_inventory_id),
          editing: false
        }))
        showSuggestedItems.value = true
      }

      extractionSuccess.value = true
      setTimeout(() => { extractionSuccess.value = false }, 5000)
    }
  } catch (error) {
    console.error('Extraction error:', error)
    extractionError.value = error.message || 'Error al leer el comprobante'
  } finally {
    extractingData.value = false
  }
}

const handleDrop = (e) => {
  isDragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file && file.type.startsWith('image/')) {
    uploadFile(file)
  }
}

const uploadFile = async (file) => {
  if (!file.type.startsWith('image/')) {
    uploadError.value = 'Solo se permiten archivos de imagen'
    return
  }
  
  uploading.value = true
  uploadError.value = ''
  
  try {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch('/api/uploads/receipt', {
      method: 'POST',
      credentials: 'include',
      body: formData
    })

    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error || 'Error al subir imagen')
    }

    const { imageUrl } = await response.json()
    form.value.receipt_url = imageUrl
    imageLoadError.value = false
  } catch (error) {
    console.error('Upload error:', error)
    uploadError.value = error.message || 'Error al subir imagen'
  } finally {
    uploading.value = false
  }
}

const saveExpense = async () => {
  if (!form.value.amount || !form.value.organization_id || !form.value.venue_id || !form.value.category_id) {
    alert('Por favor complete los campos requeridos')
    return
  }
  
  saving.value = true
  try {
    const url = isEditing.value 
      ? `/api/expenses/${route.params.id}` 
      : '/api/expenses'
    const method = isEditing.value ? 'PUT' : 'POST'
    
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(form.value)
    })
    
    if (response.ok) {
      // If creating and there are pending inventory items, add them
      if (!isEditing.value && pendingInventoryItems.value.length > 0) {
        const created = await response.json()
        const expenseId = created.id
        for (const item of pendingInventoryItems.value) {
          try {
            await fetch(`/api/expenses/${expenseId}/inventory-items`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                inventory_item_id: item.inventory_item_id,
                quantity: item.quantity,
                unit_cost: item.unit_cost || null,
              })
            })
          } catch (err) {
            console.error('Error adding pending inventory item:', err)
          }
        }
        pendingInventoryItems.value = []
      }
      if (route.query.accommodation_id) {
        router.push(`/business/accommodations/${route.query.accommodation_id}`)
      } else {
        router.push('/business/expenses')
      }
    } else {
      const error = await response.json()
      alert(error.error || 'Error al guardar el gasto')
    }
  } catch (error) {
    console.error('Error saving expense:', error)
    alert('Error al guardar el gasto')
  } finally {
    saving.value = false
  }
}

watch(() => form.value.venue_id, (newVal) => {
  if (newVal) {
    loadAvailableInventory()
    loadAccommodations()
  } else {
    accommodations.value = []
    form.value.accommodation_id = ''
  }
})

onMounted(async () => {
  await Promise.all([loadOrganizations(), loadVenues(), loadCategories()])

  // Handle venue_id query param (set synchronously so template renders immediately)
  if (route.query.venue_id && !isEditing.value) {
    form.value.venue_id = route.query.venue_id
    const venue = venues.value.find(v => String(v.id) === String(route.query.venue_id))
    if (venue && venue.organization) {
      form.value.organization_id = venue.organization
    }
  }

  // Handle accommodation_id query param (sets accommodation + may also set venue/org from API)
  if (route.query.accommodation_id && !isEditing.value) {
    form.value.accommodation_id = route.query.accommodation_id
    try {
      const accRes = await fetch(`/api/accommodations/${route.query.accommodation_id}`, { credentials: 'include' })
      if (accRes.ok) {
        const accData = await accRes.json()
        if (accData.venue_data) {
          form.value.venue_id = accData.venue_data.id
          if (accData.venue_data.organization) {
            form.value.organization_id = accData.venue_data.organization
          }
        }
      }
    } catch (e) {
      console.error('Error loading accommodation:', e)
    }
  }

  await loadExpense()

  if (isEditing.value) {
    await Promise.all([loadExpenseInventoryItems(), loadAvailableInventory(), loadAccommodations()])
  } else if (form.value.venue_id) {
    await Promise.all([loadAvailableInventory(), loadAccommodations()])
  }
})
</script>

<style scoped>
.receipt-upload-area {
  border: 2px dashed var(--cui-border-color);
  border-radius: 0.375rem;
  padding: 2rem;
  cursor: pointer;
  transition: all 0.2s ease;
  background-color: var(--cui-body-bg);
}

.receipt-upload-area:hover,
.receipt-upload-area:focus {
  border-color: var(--cui-primary);
  background-color: var(--cui-light);
  outline: none;
}

.receipt-upload-area.is-dragging {
  border-color: var(--cui-primary);
  background-color: rgba(var(--cui-primary-rgb), 0.1);
}

.receipt-upload-area.is-uploading {
  cursor: wait;
  pointer-events: none;
  opacity: 0.7;
}

.receipt-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 200px;
  height: 150px;
  border: 1px solid var(--cui-border-color);
  border-radius: 0.375rem;
  background-color: var(--cui-light);
  cursor: pointer;
}

.receipt-placeholder:hover {
  background-color: var(--cui-gray-200);
}

.provider-suggestions {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 1000;
  background-color: var(--cui-body-bg);
  border: 1px solid var(--cui-border-color);
  border-top: none;
  border-radius: 0 0 0.375rem 0.375rem;
  max-height: 200px;
  overflow-y: auto;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.provider-suggestion {
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  transition: background-color 0.15s;
}

.provider-suggestion:hover {
  background-color: var(--cui-light);
}

.provider-suggestion.provider-create {
  border-top: 1px solid var(--cui-border-color);
  color: var(--cui-primary);
  font-weight: 500;
}

.cursor-pointer {
  cursor: pointer;
}
</style>
