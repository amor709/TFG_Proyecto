from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0007_listeninghistory_usertag'),
    ]

    operations = [
        migrations.CreateModel(
            name='PlaybackSession',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('session_id', models.CharField(max_length=255, unique=True)),
                ('track_id', models.IntegerField(blank=True, null=True)),
                ('track_title', models.CharField(blank=True, max_length=255)),
                ('track_artist', models.CharField(blank=True, max_length=255)),
                ('current_time', models.FloatField(default=0.0)),
                ('is_playing', models.BooleanField(default=False)),
                ('device_info', models.CharField(blank=True, max_length=255)),
                ('user_agent', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('last_activity', models.DateTimeField(default=django.utils.timezone.now)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='playback_session', to='accounts.user')),
            ],
            options={
                'verbose_name': 'Sesión de reproducción',
                'verbose_name_plural': 'Sesiones de reproducción',
                'ordering': ['-last_activity'],
            },
        ),
    ]
