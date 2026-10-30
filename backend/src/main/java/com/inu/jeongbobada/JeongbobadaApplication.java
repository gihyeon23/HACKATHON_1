package com.inu.jeongbobada;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class JeongbobadaApplication {

	public static void main(String[] args) {
		SpringApplication.run(JeongbobadaApplication.class, args);
	}

}
