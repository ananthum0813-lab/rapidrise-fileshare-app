# """
# Celery tasks for authentication app.
# """

# import logging
# from celery import shared_task
# from django.core.mail import send_mail
# from django.template.loader import render_to_string
# from django.conf import settings

# logger = logging.getLogger(__name__)


# @shared_task(
#     bind=True,
#     max_retries=3,
#     default_retry_delay=60,
#     name='apps.authentication.tasks.send_password_reset_email'
# )
# def send_password_reset_email(self, user_email: str, user_name: str, reset_link: str):
#     """
#     Asynchronously send password reset email to user.
#     """
#     try:
#         subject = 'Reset Your FileShare Password'
#         html_message = render_to_string('emails/password_reset.html', {
#             'user_name': user_name,
#             'reset_link': reset_link,
#             'expiry_hours': settings.PASSWORD_RESET_TOKEN_EXPIRY_HOURS,
#         })
#         plain_message = (
#             f'Hello {user_name},\n\n'
#             f'You requested a password reset for your FileShare account.\n\n'
#             f'Click the link below to reset your password:\n{reset_link}\n\n'
#             f'This link expires in {settings.PASSWORD_RESET_TOKEN_EXPIRY_HOURS} hours.\n\n'
#             f'If you did not request this, please ignore this email.\n\n'
#             f'— The FileShare Team'
#         )

#         send_mail(
#             subject=subject,
#             message=plain_message,
#             html_message=html_message,
#             from_email=settings.DEFAULT_FROM_EMAIL,
#             recipient_list=[user_email],
#             fail_silently=False,
#         )
#         logger.info(f'Password reset email sent successfully to {user_email}')

#     except Exception as exc:
#         logger.error(f'Failed to send password reset email to {user_email}: {exc}')
#         raise self.retry(exc=exc)