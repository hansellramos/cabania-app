<template>
  <CRow>
    <CCol :xs="12">
      <CCard class="mb-4">
        <CCardHeader class="d-flex justify-content-between align-items-center">
          <strong>Detalle del Hospedaje</strong>
          <div class="d-flex gap-2 flex-wrap">
            <CButton color="warning" size="sm" @click="$router.push(`/business/accommodations/${route.params.id}/edit`)">
              Editar
            </CButton>
            <CButton color="danger" size="sm" @click="onDelete">
              Eliminar
            </CButton>
            <CButton color="secondary" size="sm" variant="outline" @click="$router.push('/business/accommodations')">
              Volver
            </CButton>
          </div>
        </CCardHeader>
        <CCardBody v-if="accommodation">
          <CNav variant="tabs" class="mb-3">
            <CNavItem>
              <CNavLink href="javascript:void(0)" :active="activeTab === 0" @click="activeTab = 0">
                Resumen
              </CNavLink>
            </CNavItem>
            <CNavItem>
              <CNavLink href="javascript:void(0)" :active="activeTab === 1" @click="activeTab = 1">
                Pagos
              </CNavLink>
            </CNavItem>
            <CNavItem>
              <CNavLink href="javascript:void(0)" :active="activeTab === 2" @click="activeTab = 2">
                Depósito
              </CNavLink>
            </CNavItem>
            <CNavItem>
              <CNavLink href="javascript:void(0)" :active="activeTab === 3" @click="activeTab = 3">
                Comisiones y Gastos
              </CNavLink>
            </CNavItem>
            <CNavItem>
              <CNavLink href="javascript:void(0)" :active="activeTab === 4" @click="activeTab = 4">
                Mensajes
              </CNavLink>
            </CNavItem>
          </CNav>

          <CTabContent>
            <!-- Tab Resumen -->
            <CTabPane :visible="activeTab === 0">
              <CRow>
                <CCol :md="6">
                  <h6 class="text-muted">Cliente</h6>
                  <p class="fs-5">{{ accommodation.customer_data?.fullname || accommodation.customer_data?.user_data?.email || '—' }}</p>
                </CCol>
                <CCol :md="6">
                  <h6 class="text-muted">Cabaña</h6>
                  <p class="fs-5">
                    <router-link
                      v-if="accommodation.venue_data?.id"
                      :to="`/business/venues/${accommodation.venue_data.id}`"
                      class="text-decoration-none"
                    >
                      {{ accommodation.venue_data?.name || '—' }}
                    </router-link>
                    <span v-else>{{ accommodation.venue_data?.name || '—' }}</span>
                  </p>
                </CCol>
              </CRow>
              <CRow class="mt-3">
                <CCol :md="6">
                  <h6 class="text-muted">Organización</h6>
                  <p>{{ accommodation.venue_data?.organization_data?.name || '—' }}</p>
                </CCol>
                <CCol :md="6">
                  <h6 class="text-muted">Fecha</h6>
                  <p>{{ formatDate(accommodation.date) }}</p>
                </CCol>
              </CRow>
              <CRow class="mt-3">
                <CCol :md="6">
                  <h6 class="text-muted">Check In</h6>
                  <p>{{ formatTime(accommodation.time) }}</p>
                </CCol>
                <CCol :md="6">
                  <h6 class="text-muted">Duración</h6>
                  <p>{{ formatDuration(accommodation.duration) }}</p>
                </CCol>
              </CRow>
              <CRow class="mt-3">
                <CCol :md="6">
                  <h6 class="text-muted">Check Out</h6>
                  <p>{{ calcCheckout(accommodation.time, accommodation.duration, accommodation.date) }}</p>
                </CCol>
                <CCol :md="6">
                  <h6 class="text-muted">Creado</h6>
                  <p>{{ new Date(accommodation.created_at).toLocaleString('es-CO') }}</p>
                </CCol>
              </CRow>
              <CRow class="mt-3">
                <CCol :md="4">
                  <h6 class="text-muted">Total Asistentes</h6>
                  <p class="fs-4 fw-bold">{{ (accommodation.adults || 0) + (accommodation.children || 0) }}</p>
                </CCol>
                <CCol :md="4">
                  <h6 class="text-muted">Adultos</h6>
                  <p class="fs-5">{{ accommodation.adults || 0 }}</p>
                </CCol>
                <CCol :md="4">
                  <h6 class="text-muted">Niños</h6>
                  <p class="fs-5">{{ accommodation.children || 0 }}</p>
                </CCol>
              </CRow>
              <hr />
              <CRow class="mt-3">
                <CCol :xs="12">
                  <h5 class="mb-3">Resumen Financiero</h5>
                  <div class="row g-3">
                    <div class="col-md-4">
                      <div class="p-3 border rounded text-center">
                        <h6 class="text-muted mb-2">Valor Alquilado</h6>
                        <p class="fs-4 fw-bold text-primary mb-0">{{ formatCurrency(accommodation.agreed_price || accommodation.calculated_price || 0) }}</p>
                        <small v-if="hasDiscount" class="text-success">
                          <s class="text-muted">${{ formatNumber(accommodation.calculated_price) }}</s>
                          (-{{ discountPercent }}%)
                        </small>
                      </div>
                    </div>
                    <div class="col-md-4">
                      <div class="p-3 border rounded text-center">
                        <h6 class="text-muted mb-2">Total Abonado</h6>
                        <p class="fs-4 fw-bold text-success mb-0">{{ formatCurrency(totalPaid) }}</p>
                      </div>
                    </div>
                    <div class="col-md-4">
                      <div class="p-3 border rounded text-center" :class="{ 'border-danger': pendingBalance > 0, 'border-success': pendingBalance <= 0 }">
                        <h6 class="text-muted mb-2">Saldo Pendiente</h6>
                        <p class="fs-4 fw-bold mb-0" :class="{ 'text-danger': pendingBalance > 0, 'text-success': pendingBalance <= 0 }">
                          {{ formatCurrency(pendingBalance) }}
                        </p>
                        <small v-if="pendingBalance <= 0" class="text-success">Pagado</small>
                      </div>
                    </div>
                  </div>
                  <div class="row g-3 mt-2">
                    <div class="col-md-6">
                      <div class="p-3 border rounded text-center">
                        <h6 class="text-muted mb-2">Total Egresos</h6>
                        <p class="fs-4 fw-bold text-warning mb-0">{{ formatCurrency(totalExpenses) }}</p>
                      </div>
                    </div>
                    <div class="col-md-6">
                      <div class="p-3 border rounded text-center" :class="{ 'border-success': profit >= 0, 'border-danger': profit < 0 }">
                        <h6 class="text-muted mb-2">Ganancia</h6>
                        <p class="fs-4 fw-bold mb-0" :class="{ 'text-success': profit >= 0, 'text-danger': profit < 0 }">
                          {{ formatCurrency(profit) }}
                        </p>
                      </div>
                    </div>
                  </div>
                </CCol>
              </CRow>
              <hr />
              <CRow class="mt-3" v-if="accommodation.customer_data">
                <CCol :xs="12">
                  <h6 class="text-muted">Contacto del Cliente</h6>
                  <p v-if="accommodation.customer_data.whatsapp">
                    <a :href="'https://wa.me/57' + accommodation.customer_data.whatsapp" target="_blank" class="text-success text-decoration-none">
                      <CIcon icon="cib-whatsapp" /> {{ accommodation.customer_data.whatsapp }}
                    </a>
                  </p>
                  <p v-if="accommodation.customer_data.user_data?.email">
                    <a :href="'mailto:' + accommodation.customer_data.user_data.email" class="text-primary text-decoration-none">
                      <CIcon icon="cil-envelope-closed" /> {{ accommodation.customer_data.user_data.email }}
                    </a>
                  </p>
                </CCol>
              </CRow>

            </CTabPane>

            <!-- Tab Pagos -->
            <CTabPane :visible="activeTab === 1">
              <div class="d-flex justify-content-between align-items-center mb-3">
                <h5 class="mb-0">Pagos</h5>
                <CButton color="primary" size="sm" @click="$router.push(`/business/payments/new?accommodation_id=${route.params.id}`)">
                  Registrar Pago
                </CButton>
              </div>
              <CTable hover responsive v-if="payments.length > 0">
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell>Fecha</CTableHeaderCell>
                    <CTableHeaderCell>Monto</CTableHeaderCell>
                    <CTableHeaderCell class="d-mobile-none">Método</CTableHeaderCell>
                    <CTableHeaderCell class="d-mobile-none">Referencia</CTableHeaderCell>
                    <CTableHeaderCell>Estado</CTableHeaderCell>
                    <CTableHeaderCell>Comprobante</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  <CTableRow v-for="payment in payments" :key="payment.id" style="cursor: pointer" @click="openPaymentDetail(payment)">
                    <CTableDataCell>{{ formatPaymentDate(payment.payment_date) }}</CTableDataCell>
                    <CTableDataCell>{{ formatCurrency(payment.amount) }}</CTableDataCell>
                    <CTableDataCell class="d-mobile-none">{{ payment.payment_method || '—' }}</CTableDataCell>
                    <CTableDataCell class="d-mobile-none">{{ payment.reference || '—' }}</CTableDataCell>
                    <CTableDataCell>
                      <CBadge :color="payment.verified ? 'success' : 'warning'">
                        {{ payment.verified ? 'Verificado' : 'Pendiente' }}
                      </CBadge>
                    </CTableDataCell>
                    <CTableDataCell>
                      <CButton v-if="payment.receipt_url" color="info" size="sm" variant="outline" @click.stop="openPaymentDetail(payment)">
                        Ver
                      </CButton>
                      <span v-else class="text-muted">—</span>
                    </CTableDataCell>
                  </CTableRow>
                </CTableBody>
              </CTable>
              <div v-else class="text-muted text-center py-3">
                No hay pagos registrados para esta reservación
              </div>
              <div v-if="payments.length > 0" class="mt-2 p-2 border rounded">
                <strong>Total pagado:</strong> {{ formatCurrency(totalPaid) }}
              </div>
            </CTabPane>

            <!-- Tab Depósito -->
            <CTabPane :visible="activeTab === 2">
              <div class="d-flex justify-content-between align-items-center mb-3">
                <h5 class="mb-0">Depósito de Garantía</h5>
                <CButton
                  v-if="!deposit"
                  color="primary"
                  size="sm"
                  @click="$router.push(`/business/deposits/new?accommodation_id=${route.params.id}`)"
                >
                  Registrar Depósito
                </CButton>
              </div>

              <div v-if="deposit" class="border rounded p-3">
                <CRow>
                  <CCol :md="3">
                    <h6 class="text-muted mb-1">Monto</h6>
                    <p class="fs-4 fw-bold text-primary mb-0">{{ formatCurrency(deposit.amount) }}</p>
                    <div v-if="deposit.calculated_amount && parseFloat(deposit.amount) !== parseFloat(deposit.calculated_amount)">
                      <s class="text-muted small">Calculado: {{ formatCurrency(deposit.calculated_amount) }}</s>
                      <div v-if="deposit.override_reason" class="text-muted small">
                        Razón: {{ deposit.override_reason }}
                      </div>
                    </div>
                  </CCol>
                  <CCol :md="3">
                    <h6 class="text-muted mb-1">Estado</h6>
                    <CBadge
                      :color="depositStatusColor(deposit.status)"
                      class="px-3 py-2"
                    >
                      {{ depositStatusLabel(deposit.status) }}
                    </CBadge>
                  </CCol>
                  <CCol :md="3">
                    <h6 class="text-muted mb-1">Verificación</h6>
                    <div>
                      <CBadge :color="deposit.verified ? 'success' : 'warning'" class="px-3 py-2">
                        {{ deposit.verified ? 'Verificado' : 'Pendiente' }}
                      </CBadge>
                    </div>
                    <div v-if="deposit.verified && deposit.verified_by_user" class="small text-muted mt-1">
                      por {{ deposit.verified_by_user.name || deposit.verified_by_user.email }}
                    </div>
                    <div class="mt-2">
                      <CButton
                        v-if="!deposit.verified"
                        color="success"
                        size="sm"
                        @click="verifyDeposit"
                      >
                        Verificar
                      </CButton>
                      <CButton
                        v-else
                        color="warning"
                        size="sm"
                        variant="outline"
                        @click="unverifyDeposit"
                      >
                        Quitar verificación
                      </CButton>
                    </div>
                  </CCol>
                  <CCol :md="3">
                    <h6 class="text-muted mb-1">Fecha de Recepción</h6>
                    <p class="mb-0">{{ formatPaymentDate(deposit.payment_date) }}</p>
                  </CCol>
                </CRow>

                <CRow class="mt-3" v-if="deposit.payment_method || deposit.reference">
                  <CCol :md="6" v-if="deposit.payment_method">
                    <h6 class="text-muted mb-1">Método de Pago</h6>
                    <p class="mb-0">{{ deposit.payment_method }}</p>
                  </CCol>
                  <CCol :md="6" v-if="deposit.reference">
                    <h6 class="text-muted mb-1">Referencia</h6>
                    <p class="mb-0">{{ deposit.reference }}</p>
                  </CCol>
                </CRow>

                <CRow class="mt-3" v-if="deposit.status === 'refunded'">
                  <CCol :md="4">
                    <h6 class="text-muted mb-1">Monto Devuelto</h6>
                    <p class="fw-bold text-success mb-0">{{ formatCurrency(deposit.refund_amount) }}</p>
                  </CCol>
                  <CCol :md="4">
                    <h6 class="text-muted mb-1">Fecha de Devolución</h6>
                    <p class="mb-0">{{ formatPaymentDate(deposit.refund_date) }}</p>
                  </CCol>
                  <CCol :md="4" v-if="deposit.refund_reference">
                    <h6 class="text-muted mb-1">Referencia Devolución</h6>
                    <p class="mb-0">{{ deposit.refund_reference }}</p>
                  </CCol>
                </CRow>

                <CRow class="mt-3" v-if="deposit.status === 'claimed'">
                  <CCol :md="4">
                    <h6 class="text-muted mb-1">Monto Retenido</h6>
                    <p class="fw-bold text-danger mb-0">{{ formatCurrency(deposit.damage_amount || deposit.amount) }}</p>
                  </CCol>
                  <CCol :md="8" v-if="deposit.damage_notes">
                    <h6 class="text-muted mb-1">Motivo de Retención</h6>
                    <p class="mb-0">{{ deposit.damage_notes }}</p>
                  </CCol>
                </CRow>

                <div class="mt-3 d-flex gap-2" v-if="deposit.status === 'pending'">
                  <CButton color="success" size="sm" @click="openRefundModal">
                    Liberar Depósito
                  </CButton>
                  <CButton color="danger" size="sm" variant="outline" @click="openClaimModal">
                    Retener Depósito
                  </CButton>
                  <CButton
                    v-if="!deposit.verified"
                    color="danger"
                    size="sm"
                    @click="confirmDeleteDeposit"
                  >
                    Eliminar Depósito
                  </CButton>
                </div>

                <div class="mt-3" v-if="deposit.evidence && deposit.evidence.length > 0">
                  <h6 class="text-muted mb-2">Comprobantes</h6>
                  <div class="d-flex gap-2 flex-wrap">
                    <div
                      v-for="(ev, idx) in deposit.evidence"
                      :key="idx"
                      class="border rounded p-1 cursor-pointer"
                      style="cursor: pointer;"
                      @click="openEvidenceModal(ev)"
                    >
                      <img :src="ev.image_url" alt="Evidencia" style="width: 80px; height: 80px; object-fit: cover;" class="rounded" />
                      <div class="small text-center text-muted">{{ ev.type === 'refund' ? 'Devolución' : ev.type === 'damage' ? 'Daño' : 'Recibo' }}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div v-else class="text-muted text-center py-3">
                No hay depósito registrado para este hospedaje
              </div>
            </CTabPane>

            <!-- Tab Comisiones y Gastos -->
            <CTabPane :visible="activeTab === 3">
              <CommissionCalculator
                :accommodation-id="route.params.id"
                :accommodation="accommodation"
              />
              <hr class="my-3" />
              <div class="d-flex justify-content-between align-items-center mb-3">
                <h5 class="mb-0">Egresos del Evento</h5>
                <CButton
                  color="warning"
                  size="sm"
                  @click="$router.push(`/business/expenses/create?accommodation_id=${route.params.id}&venue_id=${accommodation.venue}`)"
                >
                  Registrar Egreso
                </CButton>
              </div>
              <CTable hover responsive v-if="expenses.length > 0">
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell>Fecha</CTableHeaderCell>
                    <CTableHeaderCell>Categoría</CTableHeaderCell>
                    <CTableHeaderCell>Monto</CTableHeaderCell>
                    <CTableHeaderCell class="d-mobile-none">Descripción</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  <CTableRow v-for="expense in expenses" :key="expense.id">
                    <CTableDataCell>{{ formatPaymentDate(expense.expense_date) }}</CTableDataCell>
                    <CTableDataCell>
                      <CBadge v-if="expense.category" :color="expense.category.color || 'secondary'">
                        {{ expense.category?.name || '-' }}
                      </CBadge>
                      <span v-else>-</span>
                    </CTableDataCell>
                    <CTableDataCell>{{ formatCurrency(expense.amount) }}</CTableDataCell>
                    <CTableDataCell class="d-mobile-none">{{ expense.description || '-' }}</CTableDataCell>
                  </CTableRow>
                </CTableBody>
              </CTable>
              <div v-else class="text-muted text-center py-3">
                No hay egresos registrados para este hospedaje
              </div>
              <div v-if="expenses.length > 0" class="mt-2 p-2 border rounded">
                <strong>Total egresos:</strong> {{ formatCurrency(totalExpenses) }}
              </div>
            </CTabPane>

            <!-- Tab Mensajes -->
            <CTabPane :visible="activeTab === 4">
              <MessageSuggestions :accommodation="accommodation" />
            </CTabPane>
          </CTabContent>

          <!-- Botones duplicados al final del contenido -->
          <div class="mt-4 d-flex gap-2 flex-wrap justify-content-end">
            <CButton color="warning" size="sm" @click="$router.push(`/business/accommodations/${route.params.id}/edit`)">
              Editar
            </CButton>
            <CButton color="danger" size="sm" @click="onDelete">
              Eliminar
            </CButton>
            <CButton color="secondary" size="sm" variant="outline" @click="$router.push('/business/accommodations')">
              Volver
            </CButton>
          </div>
        </CCardBody>
        <CCardBody v-else>
          <p class="text-muted">Cargando...</p>
        </CCardBody>
      </CCard>
    </CCol>
  </CRow>

  <CModal
    :visible="showRefundModal"
    @close="showRefundModal = false"
    backdrop="static"
  >
    <CModalHeader>
      <CModalTitle>Liberar Depósito</CModalTitle>
    </CModalHeader>
    <CModalBody>
      <div class="alert alert-info mb-3">
        <strong>Monto del depósito:</strong> {{ deposit ? formatCurrency(deposit.amount) : '' }}
      </div>
      <div class="mb-3">
        <label class="form-label">Monto a Devolver *</label>
        <CFormInput
          type="number"
          v-model="refundForm.refund_amount"
          :max="deposit?.amount"
          required
        />
      </div>
      <div class="mb-3">
        <label class="form-label">Fecha de Devolución *</label>
        <CFormInput type="date" v-model="refundForm.refund_date" required />
      </div>
      <div class="mb-3">
        <label class="form-label">Referencia de Transferencia</label>
        <CFormInput v-model="refundForm.refund_reference" placeholder="Número de comprobante" />
      </div>
      <div class="mb-3">
        <label class="form-label">Comprobante de Devolución</label>
        <div class="d-flex gap-2 mb-2">
          <CButton color="primary" size="sm" @click="$refs.refundFileInput?.click()">
            <CIcon name="cil-folder-open" class="me-1" /> Seleccionar archivo
          </CButton>
          <CButton color="info" size="sm" @click="$refs.refundCameraInput?.click()">
            <CIcon name="cil-camera" class="me-1" /> Tomar Foto
          </CButton>
        </div>
        <input ref="refundFileInput" type="file" accept="image/*" class="d-none" @change="handleRefundFile" />
        <input ref="refundCameraInput" type="file" accept="image/*" capture="environment" class="d-none" @change="handleRefundFile" />
        <div class="small text-muted">Adjunta el comprobante de la transferencia</div>
      </div>
    </CModalBody>
    <CModalFooter>
      <CButton color="secondary" variant="outline" @click="showRefundModal = false">
        Cancelar
      </CButton>
      <CButton color="success" @click="processRefund" :disabled="processingRefund">
        {{ processingRefund ? 'Procesando...' : 'Confirmar Devolución' }}
      </CButton>
    </CModalFooter>
  </CModal>

  <CModal
    :visible="showClaimModal"
    @close="showClaimModal = false"
    backdrop="static"
  >
    <CModalHeader>
      <CModalTitle>Retener Depósito</CModalTitle>
    </CModalHeader>
    <CModalBody>
      <div class="alert alert-warning mb-3">
        <strong>Monto del depósito:</strong> {{ deposit ? formatCurrency(deposit.amount) : '' }}
      </div>
      <div class="mb-3">
        <label class="form-label">Monto a Retener *</label>
        <CFormInput
          type="number"
          v-model="claimForm.damage_amount"
          :max="deposit?.amount"
          required
        />
        <div class="small text-muted mt-1">Puede ser parcial si hay devolución del resto</div>
      </div>
      <div class="mb-3">
        <label class="form-label">Motivo de la Retención *</label>
        <CFormTextarea
          v-model="claimForm.damage_notes"
          rows="3"
          placeholder="Describa los daños o motivo de la retención"
          required
        />
      </div>
      <div class="mb-3">
        <label class="form-label">Evidencia (fotos de daños)</label>
        <div class="d-flex gap-2 mb-2">
          <CButton color="primary" size="sm" @click="$refs.claimFileInput?.click()">
            <CIcon name="cil-folder-open" class="me-1" /> Seleccionar archivos
          </CButton>
          <CButton color="info" size="sm" @click="$refs.claimCameraInput?.click()">
            <CIcon name="cil-camera" class="me-1" /> Tomar Foto
          </CButton>
        </div>
        <input ref="claimFileInput" type="file" accept="image/*" multiple class="d-none" @change="handleClaimFile" />
        <input ref="claimCameraInput" type="file" accept="image/*" capture="environment" class="d-none" @change="handleClaimFile" />
        <div class="small text-muted">Adjunta fotos de los daños como evidencia</div>
      </div>
    </CModalBody>
    <CModalFooter>
      <CButton color="secondary" variant="outline" @click="showClaimModal = false">
        Cancelar
      </CButton>
      <CButton color="danger" @click="processClaim" :disabled="processingClaim">
        {{ processingClaim ? 'Procesando...' : 'Confirmar Retención' }}
      </CButton>
    </CModalFooter>
  </CModal>

  <CModal
    :visible="showEvidenceModal"
    @close="showEvidenceModal = false"
    size="lg"
  >
    <CModalHeader>
      <CModalTitle>{{ selectedEvidence?.type === 'refund' ? 'Comprobante de Devolución' : selectedEvidence?.type === 'damage' ? 'Evidencia de Daño' : 'Comprobante' }}</CModalTitle>
    </CModalHeader>
    <CModalBody class="text-center">
      <img
        v-if="selectedEvidence"
        :src="selectedEvidence.image_url"
        class="img-fluid rounded"
        style="max-height: 70vh;"
      />
      <p v-if="selectedEvidence?.description" class="mt-3 text-muted">{{ selectedEvidence.description }}</p>
    </CModalBody>
  </CModal>

  <CModal
    :visible="showReceiptModal"
    @close="showReceiptModal = false"
    size="xl"
    :keyboard="true"
    backdrop="true"
  >
    <CModalHeader close-button>
      <CModalTitle>Detalle del Pago</CModalTitle>
    </CModalHeader>
    <CModalBody class="p-4">
      <div v-if="selectedPayment" class="mb-3 p-3 border rounded">
        <CRow>
          <CCol :md="4">
            <div class="small text-muted">Monto</div>
            <div class="fw-bold">{{ formatCurrency(selectedPayment.amount) }}</div>
          </CCol>
          <CCol :md="4">
            <div class="small text-muted">Método</div>
            <div>{{ selectedPayment.payment_method || '—' }}</div>
          </CCol>
          <CCol :md="4">
            <div class="small text-muted">Fecha</div>
            <div>{{ formatPaymentDate(selectedPayment.payment_date) }}</div>
          </CCol>
        </CRow>
        <CRow class="mt-2" v-if="selectedPayment.reference">
          <CCol>
            <div class="small text-muted">Referencia</div>
            <div>{{ selectedPayment.reference }}</div>
          </CCol>
        </CRow>
        <CRow class="mt-2">
          <CCol>
            <CBadge :color="selectedPayment.verified ? 'success' : 'warning'" class="px-3 py-2">
              {{ selectedPayment.verified ? 'Verificado' : 'Pendiente de verificación' }}
            </CBadge>
            <div v-if="selectedPayment.verified && selectedPayment.verified_by_user" class="small text-muted mt-1">
              Verificado por {{ selectedPayment.verified_by_user.name || selectedPayment.verified_by_user.email }}
            </div>
          </CCol>
        </CRow>
      </div>
      <div v-if="selectedReceiptUrl" class="text-center">
        <img
          v-if="!receiptLoadError"
          :src="selectedReceiptUrl"
          class="img-fluid rounded"
          style="max-height: 60vh;"
          @error="receiptLoadError = true"
        />
        <div v-else class="text-muted py-5">
          <CIcon name="cil-image" size="3xl" class="mb-3" />
          <p>No se pudo cargar la imagen</p>
        </div>
      </div>
      <div v-else class="text-muted text-center py-4">
        Este pago no tiene comprobante adjunto
      </div>
    </CModalBody>
    <CModalFooter class="justify-content-between">
      <div>
        <CButton
          v-if="selectedPayment && !selectedPayment.verified"
          color="warning"
          variant="outline"
          class="me-2"
          @click="editPayment"
        >
          <CIcon name="cil-pencil" class="me-1" />
          Editar
        </CButton>
        <CButton
          v-if="selectedPayment && !selectedPayment.verified"
          color="success"
          :disabled="verifying"
          @click="verifyPayment"
        >
          <CIcon name="cil-check-circle" class="me-1" />
          {{ verifying ? 'Verificando...' : 'Verificar pago' }}
        </CButton>
        <span v-if="selectedPayment?.verified" class="text-success">
          <CIcon name="cil-lock-locked" class="me-1" />
          Pago bloqueado (verificado)
        </span>
      </div>
      <div>
        <CButton color="secondary" variant="outline" @click="showReceiptModal = false">
          Cerrar
        </CButton>
      </div>
    </CModalFooter>
  </CModal>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CIcon } from '@coreui/icons-vue'
import { CNav, CNavItem, CNavLink, CTabContent, CTabPane } from '@coreui/vue'
import MessageSuggestions from '@/components/accommodations/MessageSuggestions.vue'
import CommissionCalculator from '@/components/commissions/CommissionCalculator.vue'
import { deleteAccommodation } from '@/services/accommodationService'

const route = useRoute()
const router = useRouter()
const accommodation = ref(null)
const payments = ref([])
const showReceiptModal = ref(false)
const selectedReceiptUrl = ref('')
const selectedPayment = ref(null)
const receiptLoadError = ref(false)
const verifying = ref(false)
const activeTab = ref(0)

const expenses = ref([])
const deposit = ref(null)
const showRefundModal = ref(false)
const showClaimModal = ref(false)
const showEvidenceModal = ref(false)
const selectedEvidence = ref(null)
const processingRefund = ref(false)
const processingClaim = ref(false)
const refundFile = ref(null)
const claimFiles = ref([])

const refundForm = ref({
  refund_amount: '',
  refund_date: new Date().toISOString().split('T')[0],
  refund_reference: ''
})

const claimForm = ref({
  damage_amount: '',
  damage_notes: ''
})

async function onDelete() {
  if (confirm('¿Estás seguro de eliminar este hospedaje?')) {
    await deleteAccommodation(route.params.id)
    router.push('/business/accommodations')
  }
}

function openReceipt(payment) {
  selectedPayment.value = payment
  selectedReceiptUrl.value = payment.receipt_url
  receiptLoadError.value = false
  showReceiptModal.value = true
}

function openPaymentDetail(payment) {
  selectedPayment.value = payment
  selectedReceiptUrl.value = payment.receipt_url || null
  receiptLoadError.value = false
  showReceiptModal.value = true
}

function editPayment() {
  showReceiptModal.value = false
  router.push(`/business/payments/${selectedPayment.value.id}/edit?accommodation_id=${route.params.id}`)
}

async function verifyPayment() {
  if (!selectedPayment.value) return

  verifying.value = true
  try {
    const res = await fetch(`/api/payments/${selectedPayment.value.id}/verify`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ verified: true })
    })

    if (res.ok) {
      const updated = await res.json()
      selectedPayment.value = updated
      const idx = payments.value.findIndex(p => p.id === updated.id)
      if (idx !== -1) {
        payments.value[idx] = updated
      }
    } else {
      const err = await res.json()
      alert(err.error || 'Error al verificar el pago')
    }
  } catch (error) {
    console.error('Error verifying payment:', error)
    alert('Error al verificar el pago')
  } finally {
    verifying.value = false
  }
}

async function verifyDeposit() {
  if (!deposit.value) return

  try {
    const res = await fetch(`/api/deposits/${deposit.value.id}/verify`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ verified: true })
    })

    if (res.ok) {
      await loadDeposit()
    } else {
      const err = await res.json()
      alert(err.error || 'Error al verificar el depósito')
    }
  } catch (error) {
    console.error('Error verifying deposit:', error)
    alert('Error al verificar el depósito')
  }
}

async function unverifyDeposit() {
  if (!deposit.value) return

  try {
    const res = await fetch(`/api/deposits/${deposit.value.id}/verify`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ verified: false })
    })

    if (res.ok) {
      await loadDeposit()
    } else {
      const err = await res.json()
      alert(err.error || 'Error al quitar la verificación')
    }
  } catch (error) {
    console.error('Error unverifying deposit:', error)
    alert('Error al quitar la verificación')
  }
}

const totalPaid = computed(() => {
  return payments.value.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
})

const agreedPrice = computed(() => {
  if (!accommodation.value) return 0
  return parseFloat(accommodation.value.agreed_price) || parseFloat(accommodation.value.calculated_price) || 0
})

const pendingBalance = computed(() => {
  return agreedPrice.value - totalPaid.value
})

const totalExpenses = computed(() => {
  return expenses.value.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)
})

const profit = computed(() => {
  return agreedPrice.value - totalExpenses.value
})

const hasDiscount = computed(() => {
  if (!accommodation.value) return false
  const calc = parseFloat(accommodation.value.calculated_price) || 0
  const agreed = parseFloat(accommodation.value.agreed_price) || 0
  return agreed > 0 && calc > 0 && agreed < calc
})

const discountPercent = computed(() => {
  if (!accommodation.value) return 0
  const calc = parseFloat(accommodation.value.calculated_price) || 0
  const agreed = parseFloat(accommodation.value.agreed_price) || 0
  if (calc === 0) return 0
  return Math.round(((calc - agreed) / calc) * 100)
})

function formatNumber(value) {
  if (value == null) return '0'
  return Number(value).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

async function load() {
  const res = await fetch(`/api/accommodations/${route.params.id}`, { credentials: 'include' })
  if (res.ok) {
    accommodation.value = await res.json()
  }
}

async function loadPayments() {
  try {
    const res = await fetch(`/api/payments?accommodation_id=${route.params.id}`)
    if (res.ok) {
      payments.value = await res.json()
    }
  } catch (error) {
    console.error('Error loading payments:', error)
  }
}

function formatPaymentDate(date) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

function formatCurrency(amount) {
  if (amount === null || amount === undefined) return '—'
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount)
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const year = d.getUTCFullYear()
  const month = d.toLocaleString('es-CO', { month: 'long', timeZone: 'UTC' })
  const day = d.getUTCDate()
  return `${day} de ${month} de ${year}`
}

function formatTime(timeStr) {
  if (!timeStr) return '—'
  if (timeStr.includes('T')) {
    const d = new Date(timeStr)
    const hours = String(d.getUTCHours()).padStart(2, '0')
    const mins = String(d.getUTCMinutes()).padStart(2, '0')
    return `${hours}:${mins}`
  }
  return timeStr.slice(0, 5)
}

function formatDuration(seconds) {
  if (!seconds) return '—'
  const s = Number(seconds)
  if (s % 86400 === 0) return (s / 86400) + ' día(s)'
  if (s % 3600 === 0) return (s / 3600) + ' hora(s)'
  if (s >= 3600) {
    const d = Math.floor(s / 86400)
    const h = Math.floor((s % 86400) / 3600)
    return (d ? d + ' día(s) ' : '') + (h ? h + ' hora(s)' : '')
  }
  return s + ' segundos'
}

function calcCheckout(timeStr, duration, dateStr) {
  if (!timeStr || !duration || !dateStr) return '—'

  const dateObj = new Date(dateStr)
  const year = dateObj.getUTCFullYear()
  const month = dateObj.getUTCMonth()
  const day = dateObj.getUTCDate()

  let hours = 0, minutes = 0
  if (timeStr.includes('T')) {
    const timeDate = new Date(timeStr)
    hours = timeDate.getUTCHours()
    minutes = timeDate.getUTCMinutes()
  } else {
    const [h, m] = timeStr.split(':').map(Number)
    hours = h
    minutes = m
  }

  const startMs = Date.UTC(year, month, day, hours, minutes)
  const endMs = startMs + Number(duration) * 1000
  const end = new Date(endMs)

  return end.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }) +
    ' ' + String(end.getUTCHours()).padStart(2, '0') + ':' + String(end.getUTCMinutes()).padStart(2, '0')
}

async function loadExpenses() {
  try {
    const res = await fetch(`/api/expenses?accommodation_id=${route.params.id}`, { credentials: 'include' })
    if (res.ok) {
      expenses.value = await res.json()
    }
  } catch (error) {
    console.error('Error loading expenses:', error)
  }
}

async function loadDeposit() {
  try {
    const res = await fetch(`/api/deposits?accommodation_id=${route.params.id}`, { credentials: 'include' })
    if (res.ok) {
      const deposits = await res.json()
      deposit.value = deposits.length > 0 ? deposits[0] : null
    }
  } catch (error) {
    console.error('Error loading deposit:', error)
  }
}

function depositStatusColor(status) {
  const colors = {
    pending: 'warning',
    refunded: 'success',
    claimed: 'danger'
  }
  return colors[status] || 'secondary'
}

function depositStatusLabel(status) {
  const labels = {
    pending: 'Pendiente',
    refunded: 'Devuelto',
    claimed: 'Retenido'
  }
  return labels[status] || status
}

async function confirmDeleteDeposit() {
  if (!confirm('¿Estás seguro de eliminar este depósito? Esta acción no se puede deshacer.')) return
  try {
    const res = await fetch(`/api/deposits/${deposit.value.id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Error al eliminar depósito')
    }
    deposit.value = null
  } catch (err) {
    alert(err.message)
  }
}

function openRefundModal() {
  refundForm.value = {
    refund_amount: deposit.value?.amount || '',
    refund_date: new Date().toISOString().split('T')[0],
    refund_reference: ''
  }
  refundFile.value = null
  showRefundModal.value = true
}

function openClaimModal() {
  claimForm.value = {
    damage_amount: deposit.value?.amount || '',
    damage_notes: ''
  }
  claimFiles.value = []
  showClaimModal.value = true
}

function handleRefundFile(event) {
  refundFile.value = event.target.files[0] || null
}

function handleClaimFile(event) {
  claimFiles.value = Array.from(event.target.files)
}

async function uploadEvidence(file, type) {
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
  return { image_url: imageUrl, type }
}

async function processRefund() {
  if (!refundForm.value.refund_amount || !refundForm.value.refund_date) {
    alert('Por favor complete los campos requeridos')
    return
  }

  processingRefund.value = true
  try {
    const existingEvidence = deposit.value?.evidence || []
    const newEvidence = [...existingEvidence]

    if (refundFile.value) {
      const ev = await uploadEvidence(refundFile.value, 'refund')
      newEvidence.push(ev)
    }

    const res = await fetch(`/api/deposits/${deposit.value.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        status: 'refunded',
        refund_amount: parseFloat(refundForm.value.refund_amount),
        refund_date: refundForm.value.refund_date,
        refund_reference: refundForm.value.refund_reference || null,
        evidence: newEvidence
      })
    })

    if (res.ok) {
      showRefundModal.value = false
      await loadDeposit()
    } else {
      const err = await res.json()
      alert(err.error || 'Error al procesar la devolución')
    }
  } catch (error) {
    console.error('Error processing refund:', error)
    alert('Error al procesar la devolución')
  } finally {
    processingRefund.value = false
  }
}

async function processClaim() {
  if (!claimForm.value.damage_amount || !claimForm.value.damage_notes) {
    alert('Por favor complete los campos requeridos')
    return
  }

  processingClaim.value = true
  try {
    const existingEvidence = deposit.value?.evidence || []
    const newEvidence = [...existingEvidence]

    for (const file of claimFiles.value) {
      const ev = await uploadEvidence(file, 'damage')
      newEvidence.push(ev)
    }

    const res = await fetch(`/api/deposits/${deposit.value.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        status: 'claimed',
        damage_amount: parseFloat(claimForm.value.damage_amount),
        damage_notes: claimForm.value.damage_notes,
        evidence: newEvidence
      })
    })

    if (res.ok) {
      showClaimModal.value = false
      await loadDeposit()
    } else {
      const err = await res.json()
      alert(err.error || 'Error al procesar la retención')
    }
  } catch (error) {
    console.error('Error processing claim:', error)
    alert('Error al procesar la retención')
  } finally {
    processingClaim.value = false
  }
}

function openEvidenceModal(evidence) {
  selectedEvidence.value = evidence
  showEvidenceModal.value = true
}

onMounted(() => {
  load()
  loadPayments()
  loadDeposit()
  loadExpenses()
})
</script>
