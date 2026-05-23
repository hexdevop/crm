import { useState } from 'react'
import { User, Bell, Shield, Key, Building2 } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import Card, { CardHeader, CardBody } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Avatar from '@/components/ui/Avatar'
import { useMutation, useQuery } from '@tanstack/react-query'
import { usersApi } from '@/api/users'
import { companiesApi } from '@/api/companies'
import { getApiError } from '@/api/client'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  useGetTelegramConnectToken,
  useTelegramSettings,
  useUpdateTelegramSettings,
  useDisconnectTelegram,
} from '@/hooks/useTelegram'

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

const companySchema = z.object({
  name: z.string().min(2, 'Минимум 2 символа'),
  description: z.string().optional(),
})

type CompanyForm = z.infer<typeof companySchema>

// ─── Constants ───────────────────────────────────────────────────────────────

const TABS = [
  { id: 'profile',  label: 'Профиль',      icon: User },
  { id: 'company',  label: 'Компания',     icon: Building2 },
  { id: 'telegram', label: 'Telegram',     icon: Bell },
  { id: 'security', label: 'Безопасность', icon: Shield },
]

// ─── Main page ───────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [tab, setTab] = useState('profile')
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)

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
  const { data: tgSettings } = useTelegramSettings()
  const updateTgSettings = useUpdateTelegramSettings()
  const disconnectTelegram = useDisconnectTelegram()

  const { data: company, refetch: refetchCompany } = useQuery({
    queryKey: ['company', 'me'],
    queryFn: companiesApi.getMe,
    enabled: !!user?.company_id,
  })

  const companyForm = useForm<CompanyForm>({
    resolver: zodResolver(companySchema),
    values: { name: company?.name ?? '', description: company?.description ?? '' },
  })

  const updateCompany = useMutation({
    mutationFn: (d: CompanyForm) => companiesApi.update(user!.company_id!, d),
    onSuccess: () => {
      toast.success('Данные компании обновлены')
      refetchCompany()
    },
    onError: (e) => toast.error(getApiError(e)),
  })

  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="text-xl font-semibold text-slate-900">Настройки</h1>

      {/* Tab bar */}
      <div className="flex border-b border-slate-200 gap-1">
        {TABS.filter((t) => t.id !== 'company' || !!user?.company_id).map((t) => (
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

      {/* ── Company ── */}
      {tab === 'company' && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                <Building2 size={18} className="text-indigo-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">{company?.name ?? '—'}</p>
                <p className="text-xs text-slate-500">{company?.slug}</p>
              </div>
            </div>
          </CardHeader>
          <CardBody>
            <form
              onSubmit={companyForm.handleSubmit((d) => updateCompany.mutate(d))}
              className="space-y-4"
            >
              <Input
                label="Название компании"
                error={companyForm.formState.errors.name?.message}
                {...companyForm.register('name')}
              />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Описание</label>
                <textarea
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
                  placeholder="Краткое описание компании..."
                  {...companyForm.register('description')}
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit" loading={updateCompany.isPending}>
                  Сохранить
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {/* ── Telegram ── */}
      {tab === 'telegram' && (
        <div className="space-y-4">
          {/* Connection card */}
          <Card>
            <CardHeader>
              <p className="text-sm font-semibold text-slate-900">Подключение аккаунта</p>
            </CardHeader>
            <CardBody>
              {user?.telegram_chat_id ? (
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-xl shrink-0">
                      ✈️
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Аккаунт подключён</p>
                      <p className="text-xs text-slate-500">
                        @{user.telegram_username ?? 'unknown'}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={disconnectTelegram.isPending}
                    onClick={() =>
                      disconnectTelegram.mutate(undefined, {
                        onSuccess: () => {
                          setUser({ ...user!, telegram_chat_id: null, telegram_username: null })
                          toast.success('Telegram аккаунт отключён')
                        },
                      })
                    }
                    className="text-red-500 hover:text-red-600 border-red-200 hover:border-red-300 hover:bg-red-50"
                  >
                    Отключить аккаунт
                  </Button>
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
                          toast.success(`Отправьте боту: /connect ${data.link_token}`, { duration: 8000 }),
                      })
                    }
                  >
                    Получить токен подключения
                  </Button>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Notification settings */}
          {tgSettings && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">Настройки уведомлений</p>
                  {/* Master toggle */}
                  <button
                    type="button"
                    onClick={() => updateTgSettings.mutate({ is_enabled: !tgSettings.is_enabled })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      tgSettings.is_enabled ? 'bg-brand-600' : 'bg-slate-200'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                      tgSettings.is_enabled ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
              </CardHeader>
              <CardBody>
                {!tgSettings.is_enabled && (
                  <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
                    Уведомления отключены. Включите переключатель выше чтобы получать уведомления.
                  </p>
                )}
                <div className="space-y-3">
                  {([
                    { key: 'record_created', label: 'Новые записи',     desc: 'При создании любой записи', icon: '📝' },
                    { key: 'record_updated', label: 'Изменения записей', desc: 'При редактировании записей', icon: '✏️' },
                    { key: 'record_deleted', label: 'Удаление записей',  desc: 'При удалении записей', icon: '🗑️' },
                  ] as const).map(({ key, label, desc, icon }) => {
                    const enabled = tgSettings.notification_events[key] ?? true
                    return (
                      <div key={key} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{icon}</span>
                          <div>
                            <p className="text-sm font-medium text-slate-900">{label}</p>
                            <p className="text-xs text-slate-400">{desc}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={!tgSettings.is_enabled}
                          onClick={() =>
                            updateTgSettings.mutate({
                              notification_events: {
                                ...tgSettings.notification_events,
                                [key]: !enabled,
                              },
                            })
                          }
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-40 ${
                            enabled ? 'bg-brand-600' : 'bg-slate-200'
                          }`}
                        >
                          <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                            enabled ? 'translate-x-4.5' : 'translate-x-0.5'
                          }`} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </CardBody>
            </Card>
          )}
        </div>
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

    </div>
  )
}
