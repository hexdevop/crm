import { useState } from 'react'
import { User, Bell, Shield, Key, Settings2 } from 'lucide-react'
import { useAuthStore, useHasPermission, useIsSuperAdmin } from '@/store/auth.store'
import Card, { CardHeader, CardBody } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Avatar from '@/components/ui/Avatar'
import Spinner from '@/components/ui/Spinner'
import { useMutation } from '@tanstack/react-query'
import { usersApi } from '@/api/users'
import { getApiError } from '@/api/client'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTelegramSettings, useUpdateTelegramSettings, useGetTelegramConnectToken } from '@/hooks/useTelegram'

// ─── Schemas ────────────────────────────────────────────────────────────────

const profileSchema = z.object({
  first_name: z.string().min(1, 'Обязательное поле'),
  last_name: z.string().min(1, 'Обязательное поле'),
})

const passwordSchema = z.object({
  current_password: z.string().min(1, 'Обязательное поле'),
  new_password: z
    .string()
    .min(8, 'Минимум 8 символов')
    .max(128, 'Максимум 128 символов')
    .regex(/[A-Z]/, 'Нужна заглавная буква')
    .regex(/[a-z]/, 'Нужна строчная буква')
    .regex(/[0-9]/, 'Нужна цифра'),
})

type ProfileForm = z.infer<typeof profileSchema>
type PasswordForm = z.infer<typeof passwordSchema>

// ─── Constants ───────────────────────────────────────────────────────────────

const BASE_TABS = [
  { id: 'profile', label: 'Профиль', icon: User },
  { id: 'telegram', label: 'Telegram', icon: Bell },
  { id: 'security', label: 'Безопасность', icon: Shield },
]
const ADMIN_TAB = { id: 'telegram_admin', label: 'Telegram (Адм.)', icon: Settings2 }

const EVENT_LABELS: Record<string, string> = {
  record_created: 'Новая запись создана',
  record_updated: 'Запись обновлена',
  user_assigned: 'Назначение пользователя',
  access_expired: 'Истечение срока доступа',
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function TelegramAdminTab() {
  const { data: tgSettings, isLoading: tgLoading, isError: tgError, refetch } = useTelegramSettings()
  const updateSettings = useUpdateTelegramSettings()

  const [tgEnabled, setTgEnabled] = useState<boolean | undefined>(undefined)
  const [tgEvents, setTgEvents] = useState<Record<string, boolean> | undefined>(undefined)

  // Derived state: use tgSettings as source of truth when local state is undefined
  const currentEnabled = tgEnabled ?? tgSettings?.is_enabled ?? false
  const currentEvents = tgEvents ?? tgSettings?.notification_events ?? {}

  const toggleEvent = (key: string) => {
    setTgEvents({ ...currentEvents, [key]: !currentEvents[key] })
  }

  const saveTgSettings = () => {
    updateSettings.mutate({ is_enabled: currentEnabled, notification_events: currentEvents })
  }

  if (tgLoading) {
    return (
      <Card>
        <CardBody>
          <div className="flex items-center justify-center py-10">
            <Spinner />
          </div>
        </CardBody>
      </Card>
    )
  }

  if (tgError) {
    return (
      <Card>
        <CardBody>
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-red-600 font-medium">Не удалось загрузить настройки</p>
            <p className="text-xs text-slate-500">Проверьте соединение и попробуйте снова</p>
            <Button variant="secondary" onClick={() => refetch()}>
              Повторить
            </Button>
          </div>
        </CardBody>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <p className="text-sm font-semibold text-slate-900">Telegram — уведомления системы</p>
      </CardHeader>
      <CardBody>
        <div className="space-y-6">
          {/* Enable toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-900">Включить уведомления</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Бот будет отправлять уведомления в настроенные чаты
              </p>
            </div>
            <button
              type="button"
              onClick={() => setTgEnabled(!currentEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                currentEnabled ? 'bg-brand-600' : 'bg-slate-200'
              }`}
              aria-checked={currentEnabled}
              role="switch"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow ${
                  currentEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Notification events */}
          <div>
            <p className="text-sm font-medium text-slate-900 mb-3">События для уведомлений</p>
            <div className="space-y-2.5">
              {Object.entries(EVENT_LABELS).map(([key, label]) => (
                <label key={key} className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={!!currentEvents[key]}
                    onChange={() => toggleEvent(key)}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                  />
                  <span className="text-sm text-slate-700 group-hover:text-slate-900 transition-colors">
                    {label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Save */}
          <div className="flex justify-end pt-2 border-t border-slate-100">
            <Button onClick={saveTgSettings} loading={updateSettings.isPending}>
              Сохранить
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [tab, setTab] = useState('profile')
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const isAdmin = useHasPermission('manage_users')
  const isSuperAdmin = useIsSuperAdmin()

  // Telegram admin settings are company-scoped — superadmin has no company, so hide that tab
  const showTelegramAdmin = isAdmin && !isSuperAdmin
  const tabs = showTelegramAdmin ? [...BASE_TABS, ADMIN_TAB] : BASE_TABS

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { first_name: user?.first_name ?? '', last_name: user?.last_name ?? '' },
  })

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  })

  const updateProfile = useMutation({
    mutationFn: (d: ProfileForm) => usersApi.update(user!.id, d),
    onSuccess: (updated) => {
      toast.success('Профиль обновлён')
      setUser({ ...user!, ...updated })
    },
    onError: (e) => toast.error(getApiError(e)),
  })

  const changePassword = useMutation({
    mutationFn: (d: PasswordForm) => usersApi.changePassword(user!.id, d),
    onSuccess: () => {
      toast.success('Пароль изменён')
      passwordForm.reset()
    },
    onError: (e) => toast.error(getApiError(e)),
  })

  const connectToken = useGetTelegramConnectToken()

  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="text-xl font-semibold text-slate-900">Настройки</h1>

      {/* Tab bar */}
      <div className="flex border-b border-slate-200 gap-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.id
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Profile ── */}
      {tab === 'profile' && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <Avatar name={user?.full_name ?? 'User'} size="lg" />
              <div>
                <p className="font-semibold text-slate-900">{user?.full_name}</p>
                <p className="text-sm text-slate-500">{user?.email}</p>
              </div>
            </div>
          </CardHeader>
          <CardBody>
            <form
              onSubmit={profileForm.handleSubmit((d) => updateProfile.mutate(d))}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Имя"
                  error={profileForm.formState.errors.first_name?.message}
                  {...profileForm.register('first_name')}
                />
                <Input
                  label="Фамилия"
                  error={profileForm.formState.errors.last_name?.message}
                  {...profileForm.register('last_name')}
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit" loading={updateProfile.isPending}>
                  Сохранить
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {/* ── Telegram (personal) ── */}
      {tab === 'telegram' && (
        <Card>
          <CardHeader>
            <p className="text-sm font-semibold text-slate-900">Telegram уведомления</p>
          </CardHeader>
          <CardBody>
            {user?.telegram_chat_id ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-xl">
                  ✈️
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">Подключено</p>
                  <p className="text-xs text-slate-500">
                    @{user.telegram_username ?? 'unknown'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">
                  Подключите Telegram для получения уведомлений о новых записях и изменениях.
                </p>
                <Button
                  variant="secondary"
                  loading={connectToken.isPending}
                  onClick={() =>
                    connectToken.mutate(undefined, {
                      onSuccess: (data) =>
                        toast.success(`Отправьте боту: /connect ${data.link_token}`),
                    })
                  }
                >
                  Получить токен подключения
                </Button>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* ── Security ── */}
      {tab === 'security' && (
        <Card>
          <CardHeader>
            <p className="text-sm font-semibold text-slate-900">Смена пароля</p>
          </CardHeader>
          <CardBody>
            <form
              onSubmit={passwordForm.handleSubmit((d) => changePassword.mutate(d))}
              className="space-y-4 max-w-sm"
            >
              <Input
                label="Текущий пароль"
                type="password"
                error={passwordForm.formState.errors.current_password?.message}
                {...passwordForm.register('current_password')}
              />
              <Input
                label="Новый пароль"
                type="password"
                hint="Мин. 8 символов, заглавная и цифра"
                error={passwordForm.formState.errors.new_password?.message}
                {...passwordForm.register('new_password')}
              />
              <Button type="submit" loading={changePassword.isPending} icon={<Key size={16} />}>
                Изменить пароль
              </Button>
            </form>
          </CardBody>
        </Card>
      )}

      {/* ── Telegram Admin (company admins only, not superadmin) ── */}
      {tab === 'telegram_admin' && showTelegramAdmin && <TelegramAdminTab />}
    </div>
  )
}
