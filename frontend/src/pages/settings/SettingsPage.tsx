import { useState } from 'react'
import { User, Bell, Shield, Key } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import Card, { CardHeader, CardBody } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Avatar from '@/components/ui/Avatar'
import { useMutation } from '@tanstack/react-query'
import { usersApi } from '@/api/users'
import { getApiError } from '@/api/client'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const profileSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
})

const passwordSchema = z.object({
  current_password: z.string().min(1),
  new_password: z
    .string()
    .min(8)
    .max(128)
    .regex(/[A-Z]/)
    .regex(/[a-z]/)
    .regex(/[0-9]/),
})

type ProfileForm = z.infer<typeof profileSchema>
type PasswordForm = z.infer<typeof passwordSchema>

const TABS = [
  { id: 'profile', label: 'Профиль', icon: User },
  { id: 'telegram', label: 'Telegram', icon: Bell },
  { id: 'security', label: 'Безопасность', icon: Shield },
]

export default function SettingsPage() {
  const [tab, setTab] = useState('profile')
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { first_name: user?.first_name, last_name: user?.last_name },
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

  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="text-xl font-semibold text-slate-900">Настройки</h1>

      <div className="flex border-b border-slate-200 gap-1">
        {TABS.map((t) => (
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

      {tab === 'telegram' && (
        <Card>
          <CardHeader><p className="text-sm font-semibold text-slate-900">Telegram уведомления</p></CardHeader>
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
                  onClick={async () => {
                    try {
                      const { apiClient } = await import('@/api/client')
                      const { data } = await apiClient.post('/telegram/connect')
                      toast.success(`Отправьте боту: /connect ${data.link_token}`)
                    } catch (e) {
                      toast.error(getApiError(e))
                    }
                  }}
                >
                  Получить токен подключения
                </Button>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {tab === 'security' && (
        <Card>
          <CardHeader><p className="text-sm font-semibold text-slate-900">Смена пароля</p></CardHeader>
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
